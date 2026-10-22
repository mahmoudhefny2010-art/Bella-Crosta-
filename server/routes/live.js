const express=require('express');
const crypto=require('node:crypto');
const {z}=require('zod');
const db=require('../db');
const {requireAuth}=require('../middleware/session');
const {hasRole}=require('../services/roles');
const router=express.Router();
router.get('/',requireAuth,async(req,res)=>{
  const {watch}=z.object({watch:z.string().uuid().optional()}).strict().parse(req.query);
  const user=req.currentUser,staff=['admin','owner','kitchen','driver'].some(role=>hasRole(user,role));
  const query=db('orders');if(!staff)query.where({user_id:user.id});
  const rows=await query.select('id','status','updated_at').orderBy('updated_at','desc').orderBy('id').limit(100);
  const version=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  let tracked=null,location=null;
  if(watch){
    const order=await db('orders').where({id:watch}).select('id','status','user_id','assigned_driver_id').first();
    if(order&&(staff||order.user_id===user.id||order.assigned_driver_id===user.id)){
      tracked={id:order.id,status:order.status};
      location=await db('driver_locations').where({order_id:watch}).select('id','order_id','latitude','longitude').orderBy('recorded_at','desc').orderBy('id','desc').first()||null;
    }
  }
  const placed=rows.find(order=>order.status==='PLACED');
  res.json({version,latestPlacedId:placed?.id||null,tracked,location});
});
module.exports=router;
