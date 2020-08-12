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

const getAllCourses = (con) => {
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
};

const getCoursesByDay = (con, day = 'Senin') => {
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
      link,
      teachers_iap
    FROM courses WHERE hari = ? ORDER BY nama_mk ASC`;
    con.query(query, [day], function (err, results) {
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
};

const getCourseworkByDay = async (con, googleParam, day = 'Senin') => {
  const courses = await getCoursesByDay(con, day);
  const classroom = googleParam.google.classroom({ version: 'v1', auth: googleParam.authCLient });

  return Promise.all(
    courses.map((course) => {
      console.log(course.nama_mk);
      return new Promise((resolve, reject) => {
        classroom.courses.courseWork.list(
          {
            courseId: course.course_id,
            pageSize: 4,
            courseWorkStates: 'PUBLISHED',
          },
          (err, res) => {
            if (err) reject(err);
            const courseworks = res.data.courseWork;
            if (courseworks && courseworks.length) {
              console.log('called');
              resolve({ course, courseworks });
            } else {
              resolve([]);
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
