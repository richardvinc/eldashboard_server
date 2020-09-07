const getCourse = (con, course_id) => {
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
};

const getAllCourses = (con, mysql, teacher = '') => {
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
      FROM courses
      ${teacher === '' ? '' : 'WHERE teachers_iap LIKE ' + mysql.escape('%' + teacher + '%')}
      ORDER BY nama_mk ASC`;

    con.query(query, function (err, result, fields) {
      if (err) reject(err);
      resolve(result);
    });
  });
};

const getCoursesByDay = (con, mysql, day = 'Senin', teacher = '') => {
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
      FROM courses
      WHERE hari = ${mysql.escape(day)}
      ${teacher === '' ? '' : ' AND teachers_iap LIKE ' + mysql.escape('%' + teacher + '%')}
      ORDER BY nama_mk ASC`;

    con.query(query, function (err, results) {
      if (err) reject(err);
      resolve(results);
    });
  });
};

const getCoursework = (googleParam, course_id) => {
  return new Promise((resolve, reject) => {
    const classroom = googleParam.google.classroom({ version: 'v1', auth: googleParam.authCLient });
    classroom.courses.courseWork.list(
      {
        courseId: course_id,
        pageSize: 0,
        courseWorkStates: 'PUBLISHED',
      },
      (err, res) => {
        if (err || !res) reject(err);
        if (typeof res === 'undefined') {
          reject(null);
        } else {
          const courseworks = res.data.courseWork;
          if (courseworks && courseworks.length) {
            resolve(courseworks);
          } else {
            resolve([]);
          }
        }
      }
    );
  });
};

const getCourseworkByDay = async (con, mysql, googleParam, day = 'Senin', teacher = '') => {
  const courses = await getCoursesByDay(con, mysql, day, teacher);
  const classroom = googleParam.google.classroom({ version: 'v1', auth: googleParam.authCLient });

  return Promise.all(
    courses.map((course) => {
      // console.log(course.nama_mk);
      return new Promise((resolve, reject) => {
        classroom.courses.courseWork.list(
          {
            courseId: course.course_id,
            pageSize: 5,
            courseWorkStates: 'PUBLISHED',
          },
          (err, res) => {
            if (err) {
              console.log(`error happened when accessing course ${course.nama_mk} with ID ${course.id}`);
              resolve([]);
            }
            // console.log(res);
            if (typeof res === 'undefined') {
              console.log(`error happened when accessing course ${course.nama_mk} with ID ${course.id}`);
              resolve([]);
            } else {
              const courseworks = res.data.courseWork;
              if (courseworks && courseworks.length) {
                // console.log('called');
                resolve({ course, courseworks });
              } else {
                resolve([]);
              }
            }
          }
        );
      });
    })
  );
};

const getStudent = (googleParam, course_id) => {
  return new Promise((resolve, reject) => {
    const classroom = googleParam.google.classroom({ version: 'v1', auth: googleParam.authCLient });
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
};

const getTeacher = (googleParam, course_id) => {
  return new Promise((resolve, reject) => {
    const classroom = googleParam.google.classroom({ version: 'v1', auth: googleParam.authCLient });
    classroom.courses.teachers.list(
      {
        pageSize: 0,
        courseId: course_id,
      },
      (err, res) => {
        if (err) reject(err);
        if (typeof res === 'undefined') reject(null);
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
};

exports.getCourse = getCourse;
exports.getAllCourses = getAllCourses;
exports.getCoursesByDay = getCoursesByDay;
exports.getCoursework = getCoursework;
exports.getCourseworkByDay = getCourseworkByDay;
exports.getStudent = getStudent;
exports.getTeacher = getTeacher;
