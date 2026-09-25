#!/usr/bin/env ruby
# frozen_string_literal: true

require "xcodeproj"

mobile = File.expand_path("..", __dir__)
project_path = File.join(mobile, "ios", "Runner.xcodeproj")
abort("Runner.xcodeproj not found") unless File.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
runner = project.targets.find { |target| target.name == "Runner" }
abort("Runner target not found") unless runner

main_group = project.main_group
runner_group = main_group.groups.find { |group| group.display_name == "Runner" }
abort("Runner group not found") unless runner_group

def file_ref(group, name)
  group.files.find { |file| File.basename(file.path.to_s) == name } ||
    group.new_file(name)
end

bridge = file_ref(runner_group, "QoreSecurityBridge.swift")
unless runner.source_build_phase.files_references.include?(bridge)
  runner.source_build_phase.add_file_reference(bridge, true)
end

runner.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = "Runner/Runner.entitlements"
end

widget_group =
  main_group.groups.find { |group| group.display_name == "QoreWidget" } ||
  main_group.new_group("QoreWidget", "QoreWidget")

widget_target =
  project.targets.find { |target| target.name == "QoreWidget" } ||
  project.new_target(:app_extension, "QoreWidget", :ios, "17.0")

%w[QoreWidget.swift QoreWidgetBundle.swift].each do |name|
  ref = file_ref(widget_group, name)
  unless widget_target.source_build_phase.files_references.include?(ref)
    widget_target.source_build_phase.add_file_reference(ref, true)
  end
end
file_ref(widget_group, "Info.plist")
file_ref(widget_group, "QoreWidget.entitlements")

release = runner.build_configurations.find { |config| config.name == "Release" }
base_bundle = release&.build_settings&.fetch("PRODUCT_BUNDLE_IDENTIFIER", nil)
base_bundle = "com.qore.mobile.qoreMobile" if base_bundle.nil? || base_bundle.include?("$(")
base_bundle = base_bundle.delete('"')
widget_bundle = "#{base_bundle}.QoreWidget"

widget_target.build_configurations.each do |config|
  settings = config.build_settings
  settings["APPLICATION_EXTENSION_API_ONLY"] = "YES"
  settings["CODE_SIGN_ENTITLEMENTS"] = "QoreWidget/QoreWidget.entitlements"
  settings["GENERATE_INFOPLIST_FILE"] = "NO"
  settings["INFOPLIST_FILE"] = "QoreWidget/Info.plist"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
  settings["MARKETING_VERSION"] = "1.0"
  settings["CURRENT_PROJECT_VERSION"] = "1"
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = widget_bundle
  settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  settings["SKIP_INSTALL"] = "YES"
  settings["SWIFT_VERSION"] = "5.0"
  settings["TARGETED_DEVICE_FAMILY"] = "1,2"
end

unless runner.dependencies.any? { |dependency| dependency.target == widget_target }
  runner.add_dependency(widget_target)
end

embed_phase = runner.build_phases.find do |phase|
  phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
    phase.name == "Embed App Extensions"
end

unless embed_phase
  embed_phase = project.new(
    Xcodeproj::Project::Object::PBXCopyFilesBuildPhase
  )
  embed_phase.name = "Embed App Extensions"
  embed_phase.dst_subfolder_spec = "13"
  runner.build_phases << embed_phase
end

unless embed_phase.files_references.include?(widget_target.product_reference)
  build_file = embed_phase.add_file_reference(
    widget_target.product_reference,
    true
  )
  build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

# Flutter's Thin Binary script reads the assembled Runner bundle. Embedding an
# app extension after Thin Binary creates a dependency cycle in modern Xcode.
# Keep the extension copy phase immediately before Thin Binary.
thin_phase = runner.build_phases.find { |phase| phase.respond_to?(:name) && phase.name == "Thin Binary" }
if thin_phase
  runner.build_phases.delete(embed_phase)
  thin_index = runner.build_phases.index(thin_phase)
  runner.build_phases.insert(thin_index, embed_phase)
end

target_attributes = project.root_object.attributes["TargetAttributes"] ||= {}
[runner, widget_target].each do |target|
  attributes = target_attributes[target.uuid] ||= {}
  capabilities = attributes["SystemCapabilities"] ||= {}
  capabilities["com.apple.ApplicationGroups.iOS"] = { "enabled" => 1 }
end

project.save
puts "Configured QoreWidget target and Runner native security bridge"
