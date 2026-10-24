import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
export const palette={ink:'#183044',primary:'#1470A6',paper:'#F4F7FB',border:'#DCE5F1',white:'#FFFFFF',sub:'#607586',orange:'#9F6718'};
export const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:palette.paper},
 content:{padding:20,paddingBottom:38,gap:14},
 hero:{borderRadius:24,backgroundColor:palette.ink,padding:22,gap:9},
 heroText:{fontSize:26,fontWeight:'800',color:palette.white},
 heroSub:{fontSize:14,color:'#DDE9F6',lineHeight:21},
 card:{borderRadius:20,backgroundColor:palette.white,borderWidth:1,borderColor:palette.border,padding:18,gap:10},
 heading:{fontSize:18,fontWeight:'800',color:palette.ink},
 text:{fontSize:15,color:palette.sub,lineHeight:22},
 small:{fontSize:12,color:palette.sub,lineHeight:19},
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
  style={{padding:15,borderRadius:13,backgroundColor:disabled?'#A8B8C8':secondary?'#E5F2F9':palette.primary}}>
  <Text style={{textAlign:'center',fontWeight:'800',color:secondary?palette.primary:palette.white}}>{label}</Text>
 </Pressable>;
}
