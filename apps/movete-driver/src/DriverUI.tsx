import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
export const palette={ink:'#112F37',teal:'#056C65',paper:'#F2F7F6',border:'#D1E3E0',white:'#FFFFFF',sub:'#5E747A',amber:'#976016'};
export const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:palette.paper},
 content:{padding:20,paddingBottom:38,gap:14},
 hero:{borderRadius:24,backgroundColor:palette.ink,padding:22,gap:9},
 heroText:{fontSize:26,fontWeight:'800',color:palette.white},
 heroSub:{fontSize:14,color:'#D1E7E5',lineHeight:21},
 card:{borderRadius:20,backgroundColor:palette.white,borderWidth:1,borderColor:palette.border,padding:18,gap:10},
 heading:{fontSize:18,fontWeight:'800',color:palette.ink},
 text:{fontSize:15,color:palette.sub,lineHeight:22},
 small:{fontSize:12,color:palette.sub,lineHeight:19},
 badge:{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:7,borderRadius:40,backgroundColor:'#EAF0D7'},
 badgeText:{fontSize:12,color:'#526A24',fontWeight:'700'},
 field:{borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,fontSize:16,color:palette.ink,backgroundColor:'#FFFFFF'},
 row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}
});
export function Panel({children}:{children:React.ReactNode}){
 return <View style={styles.card}>{children}</View>;
}
export function Action({label,onPress,secondary=false,disabled=false}:{
 label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean
}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}}
  disabled={disabled} onPress={onPress}
  style={{padding:15,borderRadius:13,backgroundColor:disabled?'#A7B9BA':secondary?'#E2F2EF':palette.teal}}>
  <Text style={{textAlign:'center',fontWeight:'800',color:secondary?palette.teal:palette.white}}>{label}</Text>
 </Pressable>;
}
