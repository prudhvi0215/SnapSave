const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');


const app = express();

app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));

app.use(express.static("public"));

app.use(methodOverride('_method'));

//Mongo URI
const mongoURI = "mongodb://localhost:27017/uploadDB"

const conn = mongoose.createConnection(mongoURI);

const config = require("./config");

const client = require("twilio")(config.accountSID,config.authToken);

//DB connection
mongoose.connect("mongodb://localhost:27017/custDB",{useNewUrlParser:true});

//DB schema
const detailsSchema = new mongoose.Schema({
  email:String,
  password:String,
  number:Number,
  country:String
});

//DB model
const Cust = mongoose.model("Cust",detailsSchema);

let gfs;

conn.once('open', function(){
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
})

//Creating Storage Object (or) Engine.

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

const upload = multer({ storage });

app.get("/dashboard",function(req,res){

  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render('dashboard', {files: false});
    } else {
      files.map(file => {
        if(file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
          file.isImage = true;
        }else{
          file.isImage = false;
        }
      });
      res.render('dashboard',{files: files});
    }
  });
});



// @route GET /files
// @desc  Display all files in JSON
app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Files exist
    return res.json(files);
  });
});

// @route GET /files/:filename
// @desc  Display single file object
app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    // File exists
    return res.json(file);
  });
});

// @route GET /image/:filename
// @desc Display Image
app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

// Delete route /files/:fileName(or)id
// @desc Used To Delete File

app.delete("/files/:id", function(req,res){
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }

    res.redirect('/dashboard');
  });
})

// Delete route /files/:fileName(or)id
// @desc Used To Delete File



app.post('/upload',upload.single('file'), function(req,res){
    res.json({file: req.file });
});

app.get("/",function(req,res){
  res.render("home");
});

app.get("/register",function(req,res){

    res.render("register",{successmsg:" "});
});

app.get("/login",function(req,res){
      res.render("login",{msg:" "});
});


app.post("/login",function(req,res){

  number1=req.body.lognum;
  password1=req.body.logpass;

  Cust.findOne({number:number1},function(err,foundCust){
          if(err){
            console.log(err);
          }else{
            if(foundCust.password == password1){

                client
                      .verify
                      .services(config.serviceID)
                      .verifications
                      .create({
                        to: `+${req.body.lognum}`,
                        channel: "sms"
                      }).then(verification => {
                        console.log(verification.status);
                      });

                  res.render("verificationPage",{num: req.body.lognum});
              }
            else{
                res.render("login",{msg:"Invalid Credentials"});
              }
            }
          });

});


app.post('/verificationPage',function(req,res) {

    // var isCorrect = false;

    client
          .verify
          .services(config.serviceID)
          .verificationChecks
          .create({
            to: `+${req.body.num1}`,
            code: req.body.otp
          }).then(data => {
            console.log(data);
          });

        res.render("/dashboard");
});



app.post("/register", function(req,res){

      email1=req.body.usrmail,
      password1=req.body.pwd,
      number1=req.body.number,
      country1=req.body.cntry

      //DB details
      const custDetails = new Cust({
      email:email1,
      password:password1,
      number:number1,
      country:country1
      });

  //DB save
   custDetails.save();
   res.render("register",{successmsg:"Succesfully Registered"});

  });


app.listen(3000,function(){
  console.log("Server started at port 3000");
});
