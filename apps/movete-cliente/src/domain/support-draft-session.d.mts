export type SupportDraftSnapshot = Readonly<{
 category:string;
 serviceId:string;
 description:string;
 feedback:string;
 localOnly:true;
 submitted:false;
}>;
export type SupportDraftSession = Readonly<{
 snapshot():SupportDraftSnapshot;
 setCategory(category:string):SupportDraftSnapshot;
 setServiceId(serviceId:string):SupportDraftSnapshot;
 setDescription(description:string):SupportDraftSnapshot;
 validate():SupportDraftSnapshot;
 clear():SupportDraftSnapshot;
 dispose():SupportDraftSnapshot;
}>;
export declare function createSupportDraftSession():SupportDraftSession;
