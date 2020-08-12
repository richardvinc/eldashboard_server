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
const bodyParser = require('body-parser');
const asyncHandler = require('express-async-handler');
const app = express();
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

//mysql
const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'T!ke36O4GJh8ebW',
  database: 'eldashboard',
});

con.connect(function (err) {
  if (err) throw err;
  console.log('MySQL Connected!');
});

const admin = require('firebase-admin');
firebase_app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  apiKey: 'AIzaSyCJr2S4nkp-s0Q1xs8FocBK0mIw7pNeDbU',
  authDomain: 'el-dashboard-1596521281930.firebaseapp.com',
  databaseURL: 'https://el-dashboard-1596521281930.firebaseio.com',
  projectId: 'el-dashboard-1596521281930',
  storageBucket: 'el-dashboard-1596521281930.appspot.com',
  messagingSenderId: '694142963065',
  appId: '1:694142963065:web:744c64000066d7d3d1b3a8',
  measurementId: 'G-TKXSDRZLWG',
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

function getCourse(course_id) {
  return new Promise((resolve, reject) => {
    const query = `
    SELECT 
      prodi,
      kode_mk,
      nama_mk,
      kelas,
      ruangan,
      hari,
      mulai,
      selesai,
      course_id,
      link
    FROM courses WHERE course_id = ? ORDER BY nama_mk ASC`;
    con.query(query, [course_id], function (err, result) {
      if (err) reject(err);
      resolve(result[0]);
    });
  });
}

function getStudent(course_id) {
  return new Promise((resolve, reject) => {
    const classroom = google.classroom({ version: 'v1', auth: authCLient });
    classroom.courses.students.list(
      {
        pageSize: 0,
        courseId: course_id,
      },
      (err, res) => {
        if (err) reject(err);
        const students = res.data.students;
        if (students && students.length) {
          resolve(
            students.map((student) => {
              return student.profile;
            })
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}

function getTeacher(course_id) {
  return new Promise((resolve, reject) => {
    const classroom = google.classroom({ version: 'v1', auth: authCLient });
    classroom.courses.teachers.list(
      {
        pageSize: 0,
        courseId: course_id,
      },
      (err, res) => {
        if (err) reject(err);
        const teachers = res.data.teachers;
        if (teachers && teachers.length) {
          resolve(
            teachers.map((teacher) => {
              return teacher.profile;
            })
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}

function getAllCourses() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        prodi,
        kode_mk,
        nama_mk,
        kelas,
        ruangan,
        hari,
        mulai,
        selesai,
        course_id,
        teachers_iap,
        link 
      FROM courses ORDER BY nama_mk ASC`;
    con.query(query, function (err, result, fields) {
      if (err) reject(err);
      resolve(result);
    });
  });
}

function getCoursework(course_id) {
  return new Promise((resolve, reject) => {
    const classroom = google.classroom({ version: 'v1', auth: authCLient });
    classroom.courses.courseWork.list(
      {
        courseId: course_id,
        pageSize: 0,
      },
      (err, res) => {
        if (err) reject(err);
        const courseworks = res.data.courseWork;
        if (courseworks && courseworks.length) {
          resolve(courseworks);
        } else {
          resolve([]);
        }
      }
    );
  });
}

// verifying the token
function verifyToken(req, res, next) {
  // next();
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
        let uid = decodedToken.uid;
        // console.log(uid);
        next();
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

app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the API',
  });
});

app.get(
  '/api/courses',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const result = await getAllCourses();
    res.json(result);
  })
);

app.get(
  '/api/course/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const result = await getCourse(course_id);
    res.json(result);
  })
);

app.get(
  '/api/course_complete/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const [course, students, teachers, courseworks] = await Promise.all([
      getCourse(course_id),
      getStudent(course_id),
      getTeacher(course_id),
      getCoursework(course_id),
    ]);
    res.json({
      course,
      teachers,
      students,
      courseworks,
    });
  })
);

app.get(
  '/api/coursework/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const result = await getCoursework(course_id);
    res.json(result);
  })
);

app.get(
  '/api/student/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const result = await getStudent(course_id);
    res.json(result);
  })
);

app.get(
  '/api/teacher/:course_id',
  verifyToken,
  asyncHandler(async (req, res, next) => {
    const course_id = req.params.course_id;
    const result = await getTeacher(course_id);
    res.json(result);
  })
);

app.listen(5000, () => console.log('Server started on port 5000'));
