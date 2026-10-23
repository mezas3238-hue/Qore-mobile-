import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {A11Y_COLORS,ACTION_MIN_HEIGHT,MIN_BODY_FONT_SIZE} from './domain/accessibility-policy.mjs';
export const palette={ink:'#183044',primary:A11Y_COLORS.primary,paper:'#F4F7FB',
 border:'#DCE5F1',white:A11Y_COLORS.white,sub:'#52697A',orange:'#8B5814',
 secondary:A11Y_COLORS.secondary,disabled:A11Y_COLORS.disabled,
 disabledInk:A11Y_COLORS.disabledInk};
export const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:palette.paper},
 content:{padding:20,paddingBottom:38,gap:14},
 hero:{borderRadius:24,backgroundColor:palette.ink,padding:22,gap:9},
 heroText:{fontSize:26,fontWeight:'800',color:palette.white},
 heroSub:{fontSize:14,color:'#DDE9F6',lineHeight:21},
 card:{borderRadius:20,backgroundColor:palette.white,borderWidth:1,borderColor:palette.border,padding:18,gap:10},
 heading:{fontSize:18,fontWeight:'800',color:palette.ink},
 text:{fontSize:15,color:palette.sub,lineHeight:23},
 small:{fontSize:MIN_BODY_FONT_SIZE,color:palette.sub,lineHeight:21},
 field:{borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,
  minHeight:ACTION_MIN_HEIGHT,fontSize:16,color:palette.ink,backgroundColor:'#FFFFFF'},
 row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}
});
export function Panel({children}:{children:React.ReactNode}){
 return <View style={styles.card}>{children}</View>;
}
export function Action({label,onPress,secondary=false,disabled=false,selected=false,
 busy=false,hint}:{
 label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;
 selected?:boolean;busy?:boolean;hint?:string
}){
 const blocked=disabled||busy;
 const background=blocked?palette.disabled:secondary?palette.secondary:palette.primary;
 const color=blocked?palette.disabledInk:secondary?palette.primary:palette.white;
 return <Pressable accessibilityRole="button" accessibilityLabel={label}
  accessibilityHint={hint} accessibilityState={{disabled:blocked,selected,busy}}
  focusable disabled={blocked} onPress={onPress} hitSlop={4}
  style={({pressed})=>({paddingHorizontal:15,paddingVertical:12,minHeight:ACTION_MIN_HEIGHT,
   justifyContent:'center',borderRadius:13,backgroundColor:background,
   borderWidth:selected?2:0,borderColor:selected?palette.ink:'transparent',
   opacity:pressed?0.82:1})}>
  <Text style={{textAlign:'center',fontSize:16,lineHeight:22,fontWeight:'800',color}}>{label}</Text>
 </Pressable>;
}
