const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose =require("mongoose");
const multer=require("multer");
const path =require("path");
const fs =require("fs");
mongoose.Promise=global.Promise;
mongoose.connect("mongodb+srv://harsh951:harsh143786@cluster0.s3pqb.mongodb.net/hosp",{useNewUrlParser:true,useCreateIndex:true, useUnifiedTopology: true });
var connection =mongoose.connection;
connection.once('open',()=>{
  console.log("MongoDB database connection establised successfully")
});
const app = express();
var http = require("http").Server(app);
const io = require('socket.io')(http);
var Schema=mongoose.Schema;
const rooms={ };
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static("public"));
const chatSchema=new Schema({
  name:String,
  chat:String
})
const Chat=mongoose.model("Chat",chatSchema);
const roomSchema=mongoose.Schema({
  name:String,
  data:[chatSchema]
})
const Room=mongoose.model("Room",roomSchema);
io.on('connection', socket => {
  socket.on('new-user',(room,name) => {
    socket.join(room)
    Room.find({name:room},function(err,results){
      if(err)
      console.log(err);
      else
      socket.emit('output',results[0].data);
    });
    rooms[room].users[socket.id] = name
    socket.to(room).broadcast.emit('user-connected', name)
  })
  socket.on('send-chat-message',(room,message,name) => {
    const chat=new Chat({
      name:name,
      chat:message
    })
    chat.save();
    Room.findOneAndUpdate({name:room},{ $push: { data: chat}},{upsert:true},function(err,doc){
      if(!err)
      {
        console.log(err);
      }
      else
      {
        console.log(doc);
      }
    });
    socket.to(room).broadcast.emit('chat-message', { message: message, name: rooms[room].users[socket.id] })
  })
  socket.on('disconnect', () => {
    getUserRooms(socket).forEach(room => {
      socket.to(room).broadcast.emit('user-disconnected', rooms[room].users[socket.id])
      delete rooms[room].users[socket.id]
    })
  })
  socket.emit('new', 'name' );
})
function getUserRooms(socket) {
  return Object.entries(rooms).reduce((names, [name, room]) => {
    if (room.users[socket.id] != null) names.push(name)
    return names
  }, [])
}




var storage= multer.diskStorage({
  destination:function(req,file,cb){
    cb(null,'public/uploads');
  },
  filename:function(req,file,cb){
    cb(null,file.fieldname+'-'+Date.now()+path.extname(file.originalname));
  }
})
var upload=multer({
  storage:storage
});

const hospitalschema=mongoose.Schema({
  Patient:String,
  Age:Number,
  Gender:String,
  Date:Date,
  Docname:String,
  Image:String,
  Report:String,
  Reportstatus:String
});
const Hospital=mongoose.model("Hospital",hospitalschema);

const doctorschema=mongoose.Schema({
  name:String,
  Data:[hospitalschema]
});
const Doctor=mongoose.model("Doctor",doctorschema);
app.get("/hospital",function(req,res){
  Hospital.find({},function(err,results){
    if(err)
    console.log(err);
    else
    res.render("hospital",{patients:results});
  });
});
const ReportSchema=mongoose.Schema({
  Report:String,
  Patientname:String
});
const Report=mongoose.model("Report",ReportSchema);
app.get("/doctor/:doctorId",function(req,res){
  const requesteddoctorId=req.params.doctorId;
  Doctor.findOne({name:requesteddoctorId}, function(err, post){
    res.render("doctor",{posts:post});
   });
});
var Message = mongoose.model("Message",{ name : String, message : String});
app.post("/doctor/:doctorId",function(req,res){
  const rep=req.body.report;
  const requesteddoctorId=req.params.doctorId;
  const rept= new Report({
    Report:rep,
    Patientname:requesteddoctorId
  });
  rept.save();
  Hospital.findOneAndUpdate({Patient:requesteddoctorId},{Reportstatus:"submitted"},function(err,doc){
    if(err)
    console.log(err);
  })
  res.redirect("/hospital");
});

app.post("/hospital",upload.single('scans'),function(req,res){
  const patient=req.body.name;
  const age=req.body.age;
  const gender=req.body.gender;
  const date=req.body.date;
  const doctor=req.body.doctor;
  const image=req.file.filename;
  const hos=new Hospital({
    Patient:patient,
    Age:age,
    Gender:gender,
    Date:date,
    Docname:doctor,
    Image:image,
    Reportstatus:"Not submitted"
  });
  hos.save();
  Doctor.findOneAndUpdate({name:doctor},{ $push: { Data: hos}},{upsert:true},function(err,doc){
    if(!err)
    {
      console.log(err);
    }
    else
    {
      console.log(doc);
    }
  });
 res.redirect("/hospital");
});
app.get("/report/:patient",function(req,res){
  const pat=req.params.patient;
  Report.findOne({Patientname:pat},function(err,data){
    res.render("patientreport",{report:data});
  })
})

app.get("/chat",(req,res)=>{

  res.render("chat",{rooms:rooms});
})
app.get("/:room",(req,res)=>{
  if(rooms[req.params.room]==null)
  {
    res.redirect("/chat");
  }
  res.render("room",{roomname:req.params.room});

})
app.post("/room",(req,res)=>{
  if(rooms[req.body.room]!=null)
  {
    res.redirect("/chat");
  }
  rooms[req.body.room]={ users: {}};
  io.emit('room-created',req.body.room)
  res.redirect("/"+req.body.room);
})

var server = http.listen(3000, () => {
  console.log('server is running on port', server.address().port);
});
