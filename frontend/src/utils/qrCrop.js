export const qrCrop=(width,height,mode)=>{
 const size=Math.min(2000,mode==='maybank'?Math.round(width*.46):Math.min(width,height));
 return mode==='maybank'?{x:Math.round(width*.27),y:Math.round(height*.22),size}:{x:Math.floor((width-size)/2),y:Math.floor((height-size)/2),size};
};
