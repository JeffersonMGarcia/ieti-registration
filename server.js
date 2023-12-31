const express = require('express');
const app = express();
const port = 3000;
const connection = require("./config/db")
const cors = require("cors");
const RequestModel = require("./models/request")
const chalk = require("chalk");
const AccountsModel = require('./models/accounts');
const bcrypt = require("bcryptjs");
const cookieSession = require('cookie-session');
const AdminAccountModel = require("./models/admin_account")
const { isLogout, isLoginAdmin } = require("./middleware/isLogin")
const sequelize = require("./config/db").sequelize
const { QueryTypes, Op } = require("sequelize");
const sendEmail = require("./config/mail")


app.use(cookieSession({
  name:'session',
  secret: "qwerty15",
  maxAge: 1000 * 60 * 60 * 24
}))

//middleware
app.use(express.static("public"));
app.use(express.json(), express.urlencoded({ extended: true }))
app.set("view engine","ejs");
app.set("views", "views")

app.use(cors())

app.use(async(req, res, next) => {
  if(req.session.student){
    const checkUserAccount = await AccountsModel.findOne({ where: { email: req.session?.student?.email }, raw: true })
    if(!checkUserAccount){
      req.session = null
      return res.redirect("/login")
    }
  }

  if(req.session.admin){
    const checkAdminAccount = await AdminAccountModel.findOne({ where: { email: req.session?.admin?.email }, raw: true })
    if(!checkAdminAccount){
      req.session = null
      return res.redirect("/login")
    }
  }

  return next();
})

app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });

  next();
})

// app.get("/profile", (req, res) => {
//   con.query(`SELECT * FROM course_subjects_1st`, (error, result) => {
//     if(error) throw error;
//     res.status(200).json({ 
//       name: "jep", 
//       title: result[0].title 
    
//     }
// )

//   })
// })

//GET ACCOUNTS
app.get("/getAccounts", async(req, res) => {
  try {
    const accounts = await AdminAccountModel.findAll({ where: { role: { [Op.ne]: "admin" } }, raw: true })
    res.json({ operation: true, accounts })
  } catch (error) {
    console.log(error)
  }
})

//ADD ACCOUNT
app.post("/addAccount", async(req, res) => {
  try {
    const { fullname, email, password } = req.body

    //CHECK IF EMAIL ALREADY EXIST
    const check = await AdminAccountModel.findOne({ where: { email }, raw: true })
    if(check){
      return res.json({ operation: false, msg: "Email already exist" })
    }

    await AdminAccountModel.create({ email, pass: password, fullname })
    res.json({ operation: true })
  } catch (error) {
    console.log(error)
  }
})

//DELETE ACCOUNT
app.delete("/deleteAccount", async(req, res) => {
  try {
    const { email } = req.query
    await AdminAccountModel.destroy({ where: { email } })
    res.json({ operation: true })
  } catch (error) {
    console.log(error)
  }
})

//FORGOT PASSWORD
app.post("/forgotPassword", async(req, res) => {
  try {
    const { email } = req.body
    await sendEmail(email, req)
    res.json({ operation: true })
  } catch (error) {
    console.log(error)
  }
})

//CHANGE PASSWORD
app.post("/changepassword", async(req, res) => {
  try {
    const { newPassword, email } = req.body
    const isitUser = await AccountsModel.findOne({ where: { email }, raw: true })
    const isitAdmin = await AdminAccountModel.findOne({ where: { email }, raw: true })

    if(isitAdmin) await AdminAccountModel.update({ pass: newPassword }, { where: { email }})
    if(isitUser) await AccountsModel.update({ password: await bcrypt.hash(newPassword, 10) }, { where: { email }})

    res.json({ operation: true })
  } catch (error) {
    console.log(error)
  }
})

//API ROUTES
app.use("/api/contact", require("./routes/contact"))

//routes
app.get('/login', isLogout, (req, res) => {
    res.render("login.ejs")
});

app.post("/logout", (req, res) => {
  try {
    req.session = null
    res.json({ operation: true })
  } catch (error) {
    console.log(error)
  }
})

app.post("/login", async(req, res) => {
  try {
    //KINUHA ANG MGA DATA FROM FRONT END
    const { username, password } = req.body

    const account = await AccountsModel.findOne({ 
      where: {
        email: username
      }, 
      raw: true 
    })

    const adminAccount = await AdminAccountModel.findOne({ where: {
      email: username
    }, raw: true })

    if(account){
      const checkpwd = await bcrypt.compare(password, account.password)
      if(!checkpwd) return res.json({ operation: false, msg: "Password failed" })
      req.session.student = account
      return res.json({ operation: true, msg: "student" })
    }

    if(adminAccount) {
      if(password != adminAccount.pass) return res.json({ operation: false, msg: "Password failed" })
      req.session.admin = adminAccount
      return res.json({ operation: true, msg: "admin" })
    }

    return res.json({ operation: false, msg: "Incorrect Credentials" })    

  } catch (error) {
    console.log(error)
  }
})

app.get('/homepage', (req, res) => {
  res.render("homepage.ejs")
});

app.get('/register', (req, res) => {
  res.render("register.ejs")
});


// ALL REQUEST (GET, POST, DELETe, PUT, PATCH)
app.use('/admin', require("./routes/admin"))

app.use('/student', require("./routes/student"))

app.get('/forgotPassword', (req, res) => {
  const { email } = req.query
  if(!email) return res.redirect("/login")
  res.render("forgotPassword.ejs")
})

app.get ('/navbar', (req, res) =>{
  res.render("navbar.ejs")
})

app.get('/contacts', (req, res) =>{
  res.render("contacts.ejs")
})

app.get('/adminDashboard', isLoginAdmin, async (req, res) => {

  const requests = await RequestModel.findAll({ raw: true })
  const accounts = await AccountsModel.findAll({raw: true})
  const enrolled = await sequelize.query(`SELECT * FROM accounts AS ac INNER JOIN studentinfos AS si ON ac.id=si.id WHERE si.enrolment_status='ENROLLED'`, { type: QueryTypes.SELECT })

  res.render('adminDashboard.ejs',
  {
    numberOfRequests: requests.length,
    requests,
    numberofAccounts: accounts.length,
    enrolled: enrolled.length,
    unenrolled: accounts.length - enrolled.length,
    admin: req.session.admin
  })

})

app.get('/reg', (req, res) =>{
  res.render('reg.ejs')
})



app.listen(port, () => {
  connection.connectToDB().then(() => {
    console.log(chalk.yellow("All models were synchronized successfully."));
    console.log(chalk.green(`Listening on port ${port}`))
  })
});
