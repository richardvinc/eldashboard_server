const fn = require('./classroomFunction');

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = './credentials/token.json';
let authCLient;

// express
const express = require('express');
const asyncHandler = require('express-async-handler');
const app = express();
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// mysql
const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'localhost', // update this
  user: 'root', // update this
  password: 'T!ke36O4GJh8ebW', // update this
  database: 'eldashboard', // update this
});

con.connect(function (err) {
  if (err) throw err;
  console.log('MySQL Connected!');
});

// sambungkan proyek firebase-nya (untuk verifikasi token, dsb) dengan proyek di richard.vinc@kwikkiangie.ac.id
// untuk melihat proyek firebase-nya, akses: console.firebase.google.com
// jika diganti, artinya harus membuat api key baru di https://console.developers.google.com/
const admin = require('firebase-admin');
firebase_app = admin.initializeApp({
  credential: admin.credential.cert('./credentials/serviceAccount.json'),
  databaseURL: 'https://el-dashboard-1596521281930.firebaseio.com',
});

// Load client secrets from a local file.
fs.readFile('./credentials/credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Classroom API.
  authorize(JSON.parse(content), (oAuth) => {
    authCLient = oAuth;
  });
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

// verifying the token -> this is the middleware to verify ALL requests
function verifyToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  // Check if bearer is undefined
  if (typeof bearerHeader !== 'undefined') {
    // Split at the space
    const bearer = bearerHeader.split(' ');
    // Get token from array
    const bearerToken = bearer[1];
    // Set the token
    req.token = bearerToken;

    // verify token to firebase
    firebase_app
      .auth()
      .verifyIdToken(bearerToken)
      .then(function (decodedToken) {
        // go to the next middleware
        next();
      })
      .catch(function (error) {
        console.log(error);
        // if token is not verified, send 403 status
        res.status(403);
      });
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

// verify token and user
// kita butuh verifikasi token dan user untuk mengembalikan data/course yang hanya dimiliki user tersebut saja
function verifyTokenAndUser(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  console.log(bearerHeader);
  console.log(req.headers);
  // Check if bearer is undefined
  if (typeof bearerHeader !== 'undefined') {
    // Split at the space
    const bearer = bearerHeader.split(' ');
    // Get token from array
    const bearerToken = bearer[1];
    // Set the token
    req.token = bearerToken;

    firebase_app
      .auth()
      .verifyIdToken(bearerToken)
      .then(function (decodedToken) {
        // uid = user id
        let uid = decodedToken.uid;
        firebase_app
          .auth()
          .getUser(uid)
          .then(function (userRecord) {
            // ambil email si user untuk dioper ke middleware selanjutnya
            // email -> untuk ambil data course si user tersebut saja
            res.locals.userEmail = userRecord.email;
            next();
          })
          .catch(function (error) {
            console.log('Error fetching user data:', error);
            res.status(403);
          });
      })
      .catch(function (error) {
        console.log(error);
        res.status(403);
      });
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

// testing the API (localhost:5000/api)
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the API',
  });
});

// dapatkan semua course untuk user yang login
app.get(
  '/api/courses',
  verifyTokenAndUser,
  asyncHandler(async (req, res, next) => {
    const { userEmail } = res.locals;
    // console.log(userEmail);
    const result = await fn.getAllCourses(con, mysql, userEmail);
    res.json(result);
  })
);

// dapatkan course tertentu berdasarkan course ID (hanya data yang ada di MySQL)
app.get(
  '/api/course/:course_id',
  // kita tidak perlu verifikasi user-nya, cukup tokennya saja
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const result = await fn.getCourse(con, course_id);
    res.json(result);
  })
);

// dapatkan informasi course lengkap, termasuk teacher, student, dan coursework (tugas)
app.get(
  '/api/course_complete/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const googleParam = { google, authCLient };
    const [course, students, teachers, courseworks] = await Promise.all([
      fn.getCourse(con, course_id),
      fn.getStudent(googleParam, course_id),
      fn.getTeacher(googleParam, course_id),
      fn.getCoursework(googleParam, course_id),
    ]);
    res.json({
      course,
      teachers,
      students,
      courseworks,
    });
  })
);

// dapatkan coursework untuk course tertentu saja
app.get(
  '/api/coursework/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const googleParam = { google, authCLient };
    const result = await fn.getCoursework(googleParam, course_id);
    res.json(result);
  })
);

// dapatkan coursework untuk hari tertentu saja
app.get(
  '/api/courseworkbyday/:day/:all',
  verifyTokenAndUser,
  asyncHandler(async (req, res, next) => {
    const day = req.params.day;
    const all = req.params.all;
    const googleParam = { google, authCLient };
    const { userEmail } = res.locals;
    // console.log(userEmail);
    const result = await fn.getCourseworkByDay(con, mysql, googleParam, day, userEmail, all);
    res.json(result);
  })
);

app.get(
  '/api/student/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const googleParam = { google, authCLient };
    const result = await fn.getStudent(googleParam, course_id);
    res.json(result);
  })
);

app.get(
  '/api/teacher/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const googleParam = { google, authCLient };
    const result = await fn.getTeacher(googleParam, course_id);
    res.json(result);
  })
);

app.listen(5000, () => console.log('Server started on port 5000'));
