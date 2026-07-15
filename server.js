const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());
app.get('/api/health',(req,res)=>res.json({status:'ok'}));
app.post('/api/auth/login',(req,res)=>{
 const {username}=req.body;
 res.json({token:'demo-token',user:username||'admin'});
});
app.get('/api/machines',(req,res)=>res.json([
 {id:'EX-204',status:'Active'},
 {id:'DZ-112',status:'Active'}
]));
app.listen(process.env.PORT||5000,()=>console.log('Running'));
