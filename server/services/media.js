const {v2:cloudinary}=require('cloudinary');
function configured(){return Boolean(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);}
function client(){
  if(!configured())throw Object.assign(Error('Image storage is not configured.'),{status:503});
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME.trim(),api_key:process.env.CLOUDINARY_API_KEY.trim(),api_secret:process.env.CLOUDINARY_API_SECRET.trim(),secure:true});
  return cloudinary;
}
function cloudImage(value){
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.startsWith('/'+process.env.CLOUDINARY_CLOUD_NAME+'/image/upload/');}catch{return false;}
}
function localImage(value){return /^\/(?:assets|uploads)\/[a-zA-Z0-9_/.-]+\.(?:png|jpg|jpeg|webp|avif|gif|svg)$/i.test(value)&&!value.split('/').includes('..');}
function validImage(value){return localImage(value)||cloudImage(value);}
async function upload(buffer,options={}){
  return new Promise((resolve,reject)=>{
    client().uploader.upload_stream({resource_type:'image',folder:'bella-crosta',timeout:45000,...options},(error,result)=>error?reject(Object.assign(Error('Image upload failed. Please retry.'),{status:502})):resolve(result)).end(buffer);
  });
}
async function library(){
  if(!configured())return [];
  const result=await client().api.resources({resource_type:'image',type:'upload',prefix:'bella-crosta/',max_results:100});
  return result.resources.map(item=>({url:item.secure_url,name:item.public_id.split('/').at(-1)}));
}
module.exports={configured,client,upload,library,validImage,cloudImage,localImage};
