/**
 * Device-only rectangular document contour candidate.
 * Not a document classifier or authenticity/plate/face verification.
 * Requires actual grayscale pixels (not UI outline coordinates).
 */
export function detectDriverDocumentContour({width,height,luma}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||
  width<64||height<64||width*height>100000||
  !(luma instanceof Uint8Array)||luma.length!==width*height)
  return null;
 // Look for opposing real brightness edges enclosing the image centre.
 // Do not fabricate a bounding box when no edges exist.
 const vertical=(x)=>{
  let total=0,n=0;
  for(let y=Math.floor(height*.28);y<Math.floor(height*.72);y+=2){
   total+=Math.abs(luma[y*width+x+1]-luma[y*width+x-1]);n++;
  }
  return total/n;
 };
 const horizontal=(y)=>{
  let total=0,n=0;
  for(let x=Math.floor(width*.28);x<Math.floor(width*.72);x+=2){
   total+=Math.abs(luma[(y+1)*width+x]-luma[(y-1)*width+x]);n++;
  }
  return total/n;
 };
 const peak=(start,end,score)=>{
  let best=-1,index=-1;
  for(let n=Math.ceil(start);n<Math.floor(end);n++){
   const s=score(n);
   if(s>best){best=s;index=n;}
  }
  return {index,score:best};
 };
 const left=peak(width*.03,width*.27,vertical);
 const right=peak(width*.73,width*.97,vertical);
 const top=peak(height*.03,height*.32,horizontal);
 const bottom=peak(height*.68,height*.97,horizontal);
 const minEdge=Math.min(left.score,right.score,top.score,bottom.score);
 if(minEdge<28)return null;
 const x=left.index/width,y=top.index/height;
 const w=(right.index-left.index)/width,h=(bottom.index-top.index)/height;
 const aspect=(w*width)/(h*height);
 if(w<.55||h<.36||w>.95||h>.95||aspect<1.15||aspect>2.6||
  x<.025||y<.025||x+w>.975||y+h>.975)
  return null;
 return Object.freeze({x,y,width:w,height:h,
  confidence:Math.min(.99,.90+minEdge/2500)});
}
