/** Una página por cursor al acercarse al final de FlatList; sin techo global. */
export function canAutoLoadHistory({authenticated,configured,loading,error,nextCursor,lastRequested}={}){
 return authenticated===true&&configured===true&&loading===false
  &&(error===null||error===undefined)
  &&typeof nextCursor==='string'&&nextCursor.length>0
  &&nextCursor!==lastRequested;
}
