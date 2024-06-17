import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import nodemailer from 'nodemailer';
import util from 'util';
import cron from 'node-cron';
import dotenv from 'dotenv';


dotenv.config();

const app = express();


app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
// app.use(cors(
//     {
//         origin: ["https://hunastransportmanagement.000webhostapp.com"],
//         methods: ["POST", "GET", "PUT"],
//         credentials: true,
//         allowedHeaders: 'Content-Type, Authorization',
//     }
// ));
// app.use(express.static('public'));

// const db = mysql.createConnection({
//     host: "99.000webhost.io",
//     user: "id22090913_root",
//     password: "Kalani@123",
//     database: "id22090913_transportsystem"
// });

app.use(cors(
    {
        origin: "http://localhost:3000",
        methods: ["POST", "GET", "PUT"],
        credentials: true,
        allowedHeaders: 'Content-Type, Authorization',
    }
));
app.use(express.static('public'));

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Kalani@123",
    database: "transportsystem"
});

db.connect(error => {
    if (error) {
        console.error('Database connection failed: ' + error.stack);
        return;
    }

    console.log('Connected to database.');
});

db.query = util.promisify(db.query);

// const verifyUser  = (req, res, next) => {
//     const token = req.cookies.token;
//     if(!token){
//         return res.json({Message: "We need token, please provide it. Login Now"})
//     }else{
//         jwt.verify(token, "our-jsonwebtoken-secret-key", (err, decoded)=> {
//             if(err){
//                 return res.json({Message: "Authentication Error."});
//             }else{
//                 req.username = decoded.username;
//                 next();
//             }
//         })
//     }
// }

app.post('/admin/home', (req, res) => {
    return res.json({Status: "Success", username: req.username});
})


app.post('/admin', (req, res) => {
    const sql = "SELECT * FROM admin WHERE username=? AND password=?";
    db.query(sql, [req.body.username, req.body.password], (err, data) => {
        if(err) return res.json({loginStatus:  "Server Side Error"})
        if(data.length > 0){
            return res.json({loginStatus: true})
        }else{
            return res.json({loginStatus: "Wrong username and password"});
        }
    })
})

app.post('/admin/reset-password', async (req, res) => {
    const { username, newPassword, confirmPassword } = req.body;

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    // Update the password and confirm password in the database
    db.query('UPDATE admin SET password = ?, confirmpassword = ? WHERE username = ?', [newPassword, confirmPassword, username], (err, result) => {
        if (err) {
            // Handle SQL errors
            console.error(err);
            return res.status(500).send('Error updating password');
        }

        console.log('Password updated successfully for user:', username);
        res.send('Password updated successfully');
    });
});


app.post('/admin/home/register', (req, res) => {

    const checkUserSql = "SELECT * FROM admin WHERE username = ? OR password = ?";
    const { firstname, lastname, nic, contact, email, username, password, confirmpassword } = req.body;

    db.query(checkUserSql, [username, password], (err, result) => {
        if (err) {
            return res.json({ Message: "Error checking user" });
        }

        if (result.length > 0) {
            return res.json({ Message: "Username or Password already taken" });
        }

    const insertSql = "INSERT INTO admin (firstname, lastname, nic, contact, email, username, password, confirmpassword) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const admins = [firstname, lastname, nic, contact, email, username, password, confirmpassword];

        db.query(insertSql, admins, (err, data) => {
            if (err) {
                return res.json({ Message: "Error inserting admin" });
            }
            return res.json({ Message: "Admin Registered Successfully" });
        });
    });
});

app.post('/admin/home/register/viewAdmin', (req, res) => {
    const adminSql = "SELECT * FROM admin";

    db.query(adminSql, (err, adminData) => {
        if (err) {
            console.error('Database Error (Admin)', err);
            return res.json({ success: false, error: "Server Side Error (Admin)" });
        } else {
            return res.json({ success: true, admin: adminData });
        }
    });
});

app.post('/admin/home/register/deleteAdmin', (req, res) => {

    const { id } = req.body;
    const adminSql = "DELETE FROM admin WHERE id=?";

    db.query(adminSql, [id], (err, result) => {
        if (err) {
          console.error('Database Error (Admin)', err);
          return res.json({ success: false, error: "Server Side Error (Admin)" });
        } else {
          // After deletion, fetch the updated list of admins
          const fetchAdminSql = "SELECT * FROM admin";
          db.query(fetchAdminSql, (err, adminData) => {
            if (err) {
              console.error('Database Error (Admin)', err);
              return res.json({ success: false, error: "Server Side Error (Admin)" });
            } else {
              return res.json({ success: true, admin: adminData });
            }
          });
        }
      });
    });

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, `public/image/drivingLicense`);
    },
    filename: (req, file, cb) => {
        const username = req.params.username;
        const timestamp = new Date().getTime(); // Add timestamp to make filenames unique
        cb(null, `${file.fieldname}_${username}_${timestamp}${path.extname(file.originalname)}`);
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        if (ext !== '.jpg' && ext !== '.png' && ext !== '.jpeg' && ext !== '.pdf') {
            return cb(res.status(400).end('only jpg, png, jpeg & pdf are allowed'), false);
        }
        cb(null, true)
    }
});

const upload1 = multer({ 
    storage: storage1,
    limits: { fileSize: 1024 * 1024 * 5 },
  });

app.post('/admin/home/register/driver', upload1.single('drivingLicense'), (req, res) => {
    const {firstname, lastname, nic, contact, username, password, confirmpassword} = req.body;


    const drivingLicense = req.file ? req.file.filename : null;
    console.log('Uploaded File Path:', drivingLicense);


    const checkUserSql = "SELECT * FROM driver WHERE username = ? OR password = ?";
    
    db.query(checkUserSql, [username, password], (err, result) => {
        if (err) {
            return res.json({ Message: false, Error: "Error checking driver" });
        }

        if (result.length > 0) {
            return res.json({ Message: "Username or Password already taken" });
        }

        const insertSql = "INSERT INTO driver (firstname, lastname, nic, contact, drivingLicense, username, password, confirmpassword) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const driverDetails = [firstname, lastname, nic, contact, drivingLicense, username, password, confirmpassword];

        db.query(insertSql, driverDetails, (err, data) => {
            if (err) {
                return res.json({ Message: "Error inserting driver" });
            }
            return res.json({ Message: "Driver Registered Successfully" });
        });
    });
});

app.post('/admin/home/register/driver/viewDriver', (req, res) => {
    const driverSql = "SELECT * FROM driver";

    db.query(driverSql, (err, driverData) => {
        if (err) {
            console.error('Database Error (Driver)', err);
            return res.json({ success: false, error: "Server Side Error (Driver)" });
        } else {
            return res.json({ success: true, driver: driverData });
        }
    });
});

app.post('/admin/home/register/driver/deleteDriver', (req, res) => {

    const { id } = req.body;
    const driverSql = "DELETE FROM driver WHERE id=?";

    db.query(driverSql, [id], (err, result) => {
        if (err) {
          console.error('Database Error (Driver)', err);
          return res.json({ success: false, error: "Server Side Error (Driver)" });
        } else {
          // After deletion, fetch the updated list of admins
          const fetchDriverSql = "SELECT * FROM driver";
          db.query(fetchDriverSql, (err, driverData) => {
            if (err) {
              console.error('Database Error (Driver)', err);
              return res.json({ success: false, error: "Server Side Error (Driver)" });
            } else {
              return res.json({ success: true, driver: driverData });
            }
          });
        }
      });
    });

app.post('/admin/home/register/driver/updateDriver/dropdown', (req, res) => {
    let driversSql = "SELECT username FROM driver";

    db.query(driversSql, (err, driverssData) => {
        if (err) {
            console.error('Database Error (Drivers)', err);
            return res.json({ success: false, error: "Server Side Error (Drivers)" });
        } else {

            const username = driverssData.map(row => row.username);

            return res.json({ success: true, drivers: username });
        }
    });
});


app.post('/admin/home/register/driver/updateDriver', (req, res) => {
    const { username } = req.body;
    
    let driversSql = "SELECT * FROM driver WHERE username = ?";

    db.query(driversSql, [username], (err, driverssData) => {
        if (err) {
            console.error('Error fetching driver details', err);
            return res.json({ success: false, error: "Failed to fetch driver details" });
          }
          if (driverssData.length > 0) {
            return res.json({ success: true, driver: driverssData[0] });
          } else {
            return res.json({ success: false, error: "Driver not found" });
          }
    });
});


app.post('/admin/home/register/driver/updateDriver/editDriverRecords/:username', upload1.single('drivingLicense'), async (req, res) => {
    const { username } = req.params;
    const { firstname, lastname, nic, contact, removedFiles } = req.body;
    const newFile = req.file; // The newly uploaded file

    try {
        // Fetch the existing driver's files from the database
        const existingFileQuery = 'SELECT drivingLicense FROM driver WHERE username = ?';
        const existingFile = await new Promise((resolve, reject) => {
            db.query(existingFileQuery, [username], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result[0] || {});  // Ensure it defaults to an object if no results are found
                }
            });
        });

        let filenames = existingFile.drivingLicense ? existingFile.drivingLicense.split(',') : [];

        // Handle file removal from database
        if (removedFiles && removedFiles.drivingLicense) {
            const removedFilenames = Array.isArray(removedFiles.drivingLicense) ? removedFiles.drivingLicense : [removedFiles.drivingLicense];

            // Update the filenames list by removing the specified files
            filenames = filenames.filter(f => !removedFilenames.includes(f));

            // Insert removed files into the removed_files table
            for (let filename of removedFilenames) {
                if (existingFile.drivingLicense.includes(filename)) { // Check if the file actually exists before removing
                    const insertRemovedFileQuery = 'INSERT INTO deletionfiles (username, fileName, dateDeleted) VALUES (?, ?, NOW())';
                    db.query(insertRemovedFileQuery, [username, filename]);
                }
            }
        }
        
        // Add the new file to the database, if there is one
        if (newFile) {
            filenames.push(newFile.filename);
        }

        // Prepare to update both file and non-file fields
        let updateFields = ['firstname = ?', 'lastname = ?', 'nic = ?', 'contact = ?', 'drivingLicense = ?'];
        const queryParams = [firstname, lastname, nic, contact, filenames.join(',')];

        const updateDriverQuery = `UPDATE driver SET ${updateFields.join(', ')} WHERE username = ?`;
        queryParams.push(username);

        // Execute the update query
        await new Promise((resolve, reject) => {
            db.query(updateDriverQuery, queryParams, (err, result) => {
                if (err) {
                    console.error("Query Error:", err);
                    return res.json({ success: false, message: 'Database update failed.' });
                }
                return res.json({ success: true, message: 'Driver details updated successfully.' });
            });
        });
    } catch (error) {
        return res.json({ success: false, message: 'Failed to update the driver.' });
    }
});


app.post('/admin/home/register/user', (req, res) => {
    const checkUserSql = "SELECT * FROM user WHERE username = ? OR password = ?";
    const { firstname, lastname, contact, email, username, password, confirmpassword } = req.body;

    // Check if the email or password is already taken
    db.query(checkUserSql, [email, password], (err, result) => {
        if (err) {
            return res.json({ Message: "Error checking user" });
        }

        if (result.length > 0) {
            return res.json({ Message: "Username or Password already taken" });
        }

        // Insert the new user if email and password are unique
        const insertSql = "INSERT INTO user (firstname, lastname, contact, email, username, password, confirmpassword) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const users = [firstname, lastname, contact, email, username, password, confirmpassword];

        db.query(insertSql, users, (err, data) => {
            if (err) {
                return res.json({ Message: "Error inserting user" });
            }
            return res.json({ Message: "User Registered Successfully" });
        });
    });
});

app.post('/vehicles', (req, res) => {
    return res.json({Status: "Success", username: req.username});
})

// const verifyUser1  = (req, res, next) => {
//     const token1 = req.cookies.token1;
//     if(!token1){
//         return res.json({Message: "We need token, please provide it. Login Now"})
//     }else{
//         jwt.verify(token1, "jsonwebtoken-secret-key", (err, decoded)=> {
//             if(err){
//                 return res.json({Message: "Authentication Error."});
//             }else{
//                 req.username = decoded.username;
//                 next();
//             }
//         })
//     }
// }

app.post('/driver/dashboard', (req, res) => {
    return res.json({Status: "Success", username: req.username});
})


app.post('/driver/dashboard/journey/dropdown', (req, res) => {
    const vehicleSql = "SELECT vehicleno FROM vehicles";
    const locationSql = "SELECT location FROM locations";

    db.query(vehicleSql, (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ loginStatus2: false, Error: "Server Side Error (Vehicles)" });
        } else {
            const vehicleno = vehicleData.map(row => row.vehicleno);

            db.query(locationSql, (err, locationData) => {
                if (err) {
                    console.error('Database Error (Locations)', err);
                    return res.json({ loginStatus2: false, Error: "Server Side Error (Locations)" });
                } else {
                    const location1 = locationData.map(row => row.location);
                    

                    return res.json({ loginStatus2: true, vehicleno, location1 });
                }
            });
        }
    });
    
});

app.post('/driver/dashboard/journey', (req, res) => {
    const { drivername, tripmode, vehicleno, datetime, location, meter, tripId } = req.body;

    if (!drivername || !tripmode) {
        return res.json({ success: false, message: "Missing required fields" });
    }

    if (tripmode === 'Start') {
        const checkTripSql = "SELECT * FROM trips WHERE drivername = ? AND endDateTime IS NULL";
        db.query(checkTripSql, [drivername], (err, ongoingTrips) => {
            if (err) {
                console.error("SQL Error when checking for ongoing trips:", err);
                return res.json({ success: false, message: "An error occurred while checking for ongoing trips." });
            } else if (ongoingTrips.length > 0) {
                console.log("Ongoing trip found for driver:", drivername); // Add more logging here
                return res.json({success: false,  message: "You must end your current trip before starting a new one." });
            } else {
                const tripsSql = "INSERT INTO trips (drivername, start, vehicleno, startDateTime, location, startmeter) VALUES (?, 'Start', ?, ?, ?, ?)";
                //const tripDetails = [drivername, vehicleno, datetime, location, reason, meter];

                db.query(tripsSql,  [drivername, vehicleno, datetime, location, meter], (err, result) => {
                    if (err) {
                        console.error("SQL Error while inserting start trip details:", err);
                        return res.json({ success: false, message: "An error occurred while inserting start trip details." });
                    }

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        },
                    });
                
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: 'kalani@tadlanka.com , dilhara@tadlanka.com', // replace with admin's email
                        subject: 'New Trip Started',
                        text: `A new trip has started by ${drivername}.
                        Please review the details,
                        Vehicle No: ${vehicleno},
                        Start Date and Time: ${datetime},
                        Location: ${location},`

                    };
                
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error('Error sending notification email:', error);
                        } else {
                            console.log('Notification email sent:', info.response);
                        }
                    });
                    return res.json({ success: true, tripId: result.insertId });
                });
            }
        });
    } else if (tripmode === 'End') {
        const findTripSql = "SELECT * FROM trips WHERE drivername = ? AND start = 'Start' AND endDateTime IS NULL ORDER BY startDateTime DESC LIMIT 1";
        db.query(findTripSql, [drivername], (err, tripDetails) => {
            if (err) {
                console.error("SQL Error while fetching trip details:", err);
                return res.json({ success: false, message: "An error occurred while fetching trip details." });
            }
            if (tripDetails.length === 0) {
                return res.json({ success: false, message: "Ongoing trip not found or already ended." });
            } 
    
            const trip = tripDetails[0];
            const updateTripSql = "UPDATE trips SET end='End', endDateTime = ?, endmeter = ? WHERE id = ? AND drivername = ?";
            db.query(updateTripSql, [datetime, meter, trip.id, drivername], (updateErr, result) => {
                if (updateErr) {
                    console.error("Update Error:", updateErr);
                    return res.json({ success: false, message: "An error occurred while ending the trip." });
                }
                if (result.affectedRows === 0) {
                    return res.json({ success: false, message: "Trip not found or could not be ended." });
                }
    
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });
            
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: 'kalani@tadlanka.com , dilhara@tadlanka.com', // replace with admin's email
                    subject: 'End Trip',
                    text: `A started trip has been ended by ${drivername}. 
                    Please review the details,
                    Vehicle No: ${vehicleno},
                    End Date and Time: ${datetime},
                    Location: ${location},`
                };
            
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending notification email:', error);
                    } else {
                        console.log('Notification email sent:', info.response);
                    }
                });
    
                // Return the details of the started trip
                res.json({ 
                    success: true,
                    tripDetails: {
                        startDateTime: trip.startDateTime,
                        startLocation: trip.location,
                        startMeter: trip.startmeter,
                        vehicleNo: trip.vehicleno,
                    },
                    tripId: trip.id
                });
            });
        });
    } else {
        // Handle unexpected tripmode values
        return res.json({ success: false, message: "Invalid tripmode value" });
    }
});

app.get('/driver/dashboard/latest-start-trip/:drivername', (req, res) => {
    const drivername = req.params.drivername;

    const query ="SELECT * FROM trips WHERE drivername = ? ORDER BY startDateTime DESC LIMIT 1";

    db.query(query, [drivername], (err, result) => {
        if (err) {
            console.error("SQL Error while fetching latest trip details:", err);
            return res.json({ Error: "An error occurred while fetching the latest trip details." });
        }
        if (result.length === 0) {
            return res.json({ Error: "No trip found for this driver." });
        }

        const latestTrip = result[0];

        // Check if the latest trip has already ended
        if (latestTrip.endDateTime !== null) {
            // If yes, return an appropriate message indicating there are no ongoing trips
            return res.json({ Message: "The latest trip has already ended. There are no ongoing trips." });
        } else {
            // If the latest trip is still ongoing, return its details
            res.json({
                Status: "Success",
                LatestStartDetails: latestTrip
            });
        }
    });
});


app.post('/driver/dashboard/viewMyHistory', (req, res) => {
    const { drivername, startDate, endDate } = req.body;

    let query = "SELECT start, end, vehicleno, startDateTime, endDateTime, location, startmeter, endmeter, (endmeter - startmeter) AS meterGap FROM trips WHERE 1=1";

    const params = [];
    if (drivername) {
        query += " AND drivername=?";
        params.push(drivername);
    }

    if (startDate && endDate) {
        query += " AND (startDateTime BETWEEN ? AND ? OR endDateTime BETWEEN ? AND ? OR (startDateTime < ? AND endDateTime > ?))";
        // Repeat startDate and endDate for each placeholder in the SQL query
        params.push(startDate, endDate, startDate, endDate, startDate, endDate);
    }

    db.query(query, params, (err, result) => { // Use params here instead of [drivername]
        if (err) {
            console.error("SQL Error while fetching trip details:", err);
            return res.json({ success: false, error: "An error occurred while fetching trip details." });
        } else {
            return res.json({ success: true, trips: result });
        }
    });
});

app.post('/driver/reset-password', async (req, res) => {
    const { username, newPassword, confirmPassword } = req.body;

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    // Update the password and confirm password in the database
    db.query('UPDATE driver SET password = ?, confirmpassword = ? WHERE username = ?', [newPassword, confirmPassword, username], (err, result) => {
        if (err) {
            // Handle SQL errors
            console.error(err);
            return res.status(500).send('Error updating password');
        }

        console.log('Password updated successfully for user:', username);
        res.send('Password updated successfully');
    });
});

app.post('/driver', (req, res) => {
    const sql = "SELECT * FROM driver WHERE username=? AND password=?";
    db.query(sql, [req.body.username, req.body.password], (err, data) => {
        if(err) return res.json({loginStatus1: "Server Side Error"})
        if(data.length > 0){
            return res.json({loginStatus1: true})
        }else{
            return res.json({loginStatus1: "Wrong username and password"});
        }
    })
})

app.post('/driver/dashboard/attendance', (req, res) => {
    const { drivername, attendancemode, checkInDateTime, checkOutDateTime, checkInLocation, checkOutLocation } = req.body;

    console.log(req.body);
    if (!drivername || !attendancemode) {
        return res.json({ success: false, message: "Missing required fields" });
    }

    const checkAttendanceSql = "SELECT * FROM attendance WHERE drivername = ? AND checkOutDateTime IS NULL";

    if (attendancemode === 'In') {
        db.query(checkAttendanceSql, [drivername], (err, data) => {
            if (err) {
                console.error("Error querying existing attendance data:", err);
                return res.json({ success: false, message: "Server Side Error" });
            }
            // If data exists, it means the driver has already checked in and not checked out.
            if (data.length > 0) {
                return res.json({ success: false, message: "Driver already checked in." });
            } else {
                // If no data, insert the new check-in record.
                const attendanceSql = "INSERT INTO attendance (drivername, checkIn, checkInDateTime, checkInLocation) VALUES (?, 'In', ?, ?)";
                db.query(attendanceSql, [drivername, checkInDateTime, checkInLocation], (err, result) => {
                    if (err) {
                        console.error("SQL Error while inserting start attendance details:", err);
                        return res.json({ success: false, message: "An error occurred while inserting checkIn attendance details." });
                    } else {
                        return res.json({ success: true, message: "Check-in recorded successfully.", data: result });
                    }
                });
            }
        });
    } else if (attendancemode === 'Out') {
        const getLastInAttendanceSql = "SELECT * FROM attendance WHERE drivername = ? AND checkOutDateTime IS NULL ORDER BY checkInDateTime DESC LIMIT 1";
        db.query(getLastInAttendanceSql, [drivername], (err, attendanceDetails) => {
            if (err || attendanceDetails.length === 0) {
                console.error("Fetch or no check-in found:", err);
                return res.json({ success: false, message: "No check-in record found or error fetching data." });
            }

            const attendance = attendanceDetails[0];
            const updateAttendanceSql = "UPDATE attendance SET checkOut='Out', checkOutDateTime = ?, checkOutLocation = ? WHERE id = ? AND drivername = ?";
            db.query(updateAttendanceSql, [checkOutDateTime, checkOutLocation, attendance.id, drivername], (updateErr, result) => {
                if (updateErr) {
                    console.error("Update Error:", updateErr);
                    return res.json({ success: false, message: "An error occurred while ending the attendance." });
                }
                if (result.affectedRows === 0) {
                    return res.json({ success: false, message: "Attendance not found or could not be checked out." });
                }
                return res.json({ success: true, message: "Check out successful." });
            });
        });
    }
});

app.post('/vehicles/vehicleDetails', (req, res) => {
    const vehicleSql = "SELECT * FROM vehicles";

    db.query(vehicleSql, (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ success: false, error: "Server Side Error (Vehicles)" });
        } else {
            return res.json({ success: true, vehicles: vehicleData });
        }
    });
});

app.post('/vehicles/vehicleDetails/dropdown', (req, res) => {
    const vehicleSql = "SELECT vehicleno FROM vehicles";

    db.query(vehicleSql, (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ success: false, error: "Server Side Error (Vehicles)" });
        } else {
            const vehicleno = vehicleData.map(row => row.vehicleno);
            return res.json({ success: true, vehicleno });
        }
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const imageType = file.fieldname === 'license' ? 'license' : file.fieldname === 'registrationImage' ? 'registrationImage' : file.fieldname === 'insuranceCard' ? 'insuranceCard' : 'taxReceipts';
        cb(null, `public/image/${imageType}`);
    },
    filename: (req, file, cb) => {
        const vehicleno = req.body.vehicleno;
        const timestamp = new Date().getTime(); // Add timestamp to make filenames unique
        cb(null, `${file.fieldname}_${vehicleno}_${timestamp}${path.extname(file.originalname)}`);
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        if (ext !== '.jpg' && ext !== '.png' && ext !== '.jpeg' && ext !== '.pdf') {
            return cb(null, false);  // Use null instead of res.status(400)
        }
        cb(null, true);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 6 * 1024 * 1024 },
  });


app.post('/vehicles/vehicleDetails/add-vehicle',  upload.fields([{ name: 'license' },{ name: 'registrationImage'},{ name: 'insuranceCard' },{ name: 'taxReceipts'}]), (req, res) => {
    const { vehicleno, vehicletype, ownership, fuelType, leasedliability, cylinderCapacity, insuranceCompany, taxPayer } = req.body;
    const vehicleId = req.query.vehicleId;

    const taxPayerBoolean = Boolean(parseInt(taxPayer));
    // Assuming db.query is your method of querying the database, replace it with your actual database query method
    const checkVehicleExistsQuery = 'SELECT COUNT(*) AS count FROM vehicles WHERE vehicleno = ?';

    // Check for existing vehicle
    db.query(checkVehicleExistsQuery, [vehicleno], (err, result) => {
        if (err) {
            console.error("Database query error:", err);
            return res.json({ success: false, error: 'Failed to check existing vehicle' });
        }
        if (result[0].count > 0) {
            // Vehicle already exists
            return res.json({ success: false, error: 'Vehicle already added' });
        } else {
            // Check if licenseImage exists in req.file
            // if (!req.files || !req.files['license'] || !req.files['registrationImage'] || !req.files['insuranceCard'] || !req.files['taxReceipts']) {
            //     return res.json({ success: false, error: 'No file provided' });
            // }

            const license = req.files['license'] ? req.files['license'].map(file => file.filename) : [];
            const registrationImage = req.files['registrationImage'] ? req.files['registrationImage'].map(file => file.filename) : [];
            const insuranceCard = req.files['insuranceCard'] ? req.files['insuranceCard'].map(file => file.filename) : [];
            const taxReceipts = req.files['taxReceipts'] ? req.files['taxReceipts'].map(file => file.filename) : [];

            if (!vehicleno || !vehicletype ) {
                return res.json({ success: false, error: 'Please provide all required information' });
            }

            const insertVehicleQuery = 'INSERT INTO vehicles (vehicleno, vehicletype, license, ownership, registrationImage, fuelType, leasedliability, cylinderCapacity, insuranceCompany, insuranceCard, taxPayer, taxReceipts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

            console.log('Data:', [vehicleno, vehicletype, license.join(','), ownership, registrationImage.join(','), fuelType, leasedliability, cylinderCapacity, insuranceCompany, insuranceCard.join(','), taxPayer, taxReceipts.join(',')]);

            db.query(insertVehicleQuery, [vehicleno, vehicletype, license.join(','), ownership, registrationImage.join(','), fuelType, leasedliability,cylinderCapacity, insuranceCompany, insuranceCard.join(','), taxPayer, taxReceipts.join(','), vehicleId], (err, result) => {
                if (err) {
                    console.error('Error adding a vehicle:', err);
                    return res.json({ success: false, error: 'Failed to add the vehicle' });
                }
                const vehicleId = result.insertId; // Assuming your database generates auto-increment IDs
                console.log('Generated Vehicle ID:', vehicleId);
            
                const newVehicle = {
                    vehicleno,
                    vehicletype,
                    ownership,
                    fuelType,
                    leasedliability,
                    cylinderCapacity,
                    insuranceCompany,
                    taxPayer,
                    // Add other properties if needed
                };

                // Send the Vehicle ID along with the success response
                return res.json({ success: true, vehicle: newVehicle, message: 'Vehicle details added successfully' });
            });
        }
    });
});

app.post('/vehicles/vehicleDetails/delete-vehicle', (req, res) => {
    const { id } = req.body;
  
    // Start a transaction
    db.beginTransaction((err) => {
      if (err) {
        console.error('Error starting transaction:', err);
        return res.json({ loginStatus: false, error: 'Failed to start transaction' });
      }
  
      // Step 1: Retrieve the vehicle details
      const selectVehicleQuery = 'SELECT * FROM vehicles WHERE id=?';
      db.query(selectVehicleQuery, [id], (err, result) => {
        if (err) {
          console.error('Error retrieving vehicle details:', err);
          return db.rollback(() => {
            res.json({ loginStatus: false, error: 'Failed to retrieve vehicle details' });
          });
        }
  
        const [vehicleDetails] = result;
  
        // Step 2: Delete the vehicle
        const deleteVehicleQuery = 'DELETE FROM vehicles WHERE id=?';
        db.query(deleteVehicleQuery, [id], (err, result) => {
          if (err) {
            console.error('Error deleting a vehicle:', err);
            return db.rollback(() => {
              res.json({ loginStatus: false, error: 'Failed to delete the vehicle' });
            });
          }
  
          // Step 3: Insert into the deletedvehicles table
          const insertIntoDeletedTableQuery = 'INSERT INTO deletedvehicles (id, vehicleno, vehicletype, license, ownership, registrationImage, fuelType, leasedliability, cylinderCapacity, insuranceCompany, insuranceCard, taxPayer, taxReceipts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          db.query(
            insertIntoDeletedTableQuery,
            [
              vehicleDetails.id,
              vehicleDetails.vehicleno,
              vehicleDetails.vehicletype,
              vehicleDetails.license,
              vehicleDetails.ownership,
              vehicleDetails.registrationImage,
              vehicleDetails.fuelType,
              vehicleDetails.leasedliability,
              vehicleDetails.cylinderCapacity,
              vehicleDetails.insuranceCompany,
              vehicleDetails.insuranceCard,
              vehicleDetails.taxPayer,
              vehicleDetails.taxReceipts,
            ],
            (err, result) => {
              if (err) {
                console.error('Error inserting into deletedvehicles table:', err);
                return db.rollback(() => {
                  res.json({ loginStatus: false, error: 'Failed to store deleted vehicle details' });
                });
              }
  
              // Commit the transaction
              db.commit((err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  return db.rollback(() => {
                    res.json({ loginStatus: false, error: 'Failed to commit transaction' });
                  });
                }
  
                console.log('Transaction committed successfully.');
                res.json({ loginStatus: true, message: 'Vehicle deleted successfully' });
              });
            });
        });
      });
    });
});

app.post('/vehicles/vehicleDetails/deletedVehicles', (req, res) => {
    const selectDeletedVehiclesQuery = 'SELECT id, vehicleno, vehicletype, license, ownership, registrationImage, fuelType, leasedliability, cylinderCapacity, insuranceCompany, insuranceCard, taxPayer, taxReceipts FROM deletedvehicles';
  
    db.query(selectDeletedVehiclesQuery, (err, result) => {
      if (err) {
        console.error('Error retrieving deleted vehicles:', err);
        return res.json({ loginStatus: false, error: 'Failed to retrieve deleted vehicles' });
      }
  
      return res.json({ loginStatus: true, deletedVehicles: result });
    });
});
  
app.post('/vehicles/vehicleDetails/undoDelete', (req, res) => {
    const { id } = req.body;

    console.log('Received undoDelete request for id:', id);
    
        // Start a transaction
    db.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.json({ success: false, error: 'Failed to start transaction' });
        }
    
        // Step 1: Retrieve the vehicle details
        const selectVehicleQuery = 'SELECT * FROM deletedvehicles WHERE id=?';
        db.query(selectVehicleQuery, [id], (err, result) => {
            if (err) {
                console.error('Error retrieving vehicle details:', err);
                return db.rollback(() => {
                    res.json({ success: false, error: 'Failed to retrieve vehicle details' });
                });
            }
    
            const vehicleDetails = result[0];
    
            // Step 2: Delete the vehicle from the deletedvehicles table
            const deleteVehicleQuery = 'DELETE FROM deletedvehicles WHERE id=?';
            db.query(deleteVehicleQuery, [id], (err, result) => {
                if (err) {
                    console.error('Error deleting a vehicle from deletedvehicles:', err);
                    return db.rollback(() => {
                    res.json({ success: false, error: 'Failed to delete the vehicle from deletedvehicles' });
                    });
                }
    
            // Step 3: Insert into the vehicles table
                const insertIntoVehiclesQuery = 'INSERT INTO vehicles (id, vehicleno, vehicletype, license, ownership, registrationImage, fuelType, leasedliability, cylinderCapacity, insuranceCompany, insuranceCard, taxPayer, taxReceipts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                const taxPayerValue = vehicleDetails.taxPayer === "Yes" ? 1 : 0;
                db.query(
                    insertIntoVehiclesQuery,
                    [
                    vehicleDetails.id,
                    vehicleDetails.vehicleno,
                    vehicleDetails.vehicletype,
                    vehicleDetails.license,
                    vehicleDetails.ownership,
                    vehicleDetails.registrationImage,
                    vehicleDetails.fuelType,
                    vehicleDetails.leasedliability,
                    vehicleDetails.cylinderCapacity,
                    vehicleDetails.insuranceCompany,
                    vehicleDetails.insuranceCard,
                    taxPayerValue,
                    vehicleDetails.taxReceipts,
                    ],
                    (err, result) => {
                    if (err) {
                        console.error('Error inserting into vehicles table:', err);
                        return db.rollback(() => {
                        res.json({ success: false, error: 'Failed to restore vehicle details' });
                        });
                    }
    
            // Commit the transaction
                    db.commit((err) => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return db.rollback(() => {
                                res.json({ success: false, error: 'Failed to commit transaction' });
                            });
                        }
                
                        console.log('Transaction committed successfully.');
                        res.json({ success: true, message: 'Vehicle details restored successfully' });
                    });
                });
            });
        });
    });
});

// function deleteFile(filePath) {
//     return new Promise((resolve, reject) => {
//         fs.unlink(filePath, (err) => {
//             if (err) {
//                 if (err.code === 'ENOENT') {
//                     console.warn(`File not found, could not delete: ${filePath}`);
//                     resolve(); // File not found is not critical, resolve the promise
//                 } else {
//                     console.error(`Error deleting file: ${filePath}`, err);
//                     reject(err); // Reject for other errors
//                 }
//             } else {
//                 console.log(`File deleted successfully: ${filePath}`);
//                 resolve();
//             }
//         });
//     });
// }

app.post('/vehicles/vehicleDetails/editVehicles/:vehicleId', upload.fields([{ name: 'license' }, { name: 'registrationImage' }, { name: 'insuranceCard'}, { name: 'taxReceipts'}]), async(req, res) => {
    const { vehicleno, vehicletype, ownership, fuelType, leasedliability, cylinderCapacity, insuranceCompany, taxPayer,removedFiles } = req.body;
    const { vehicleId } = req.params;

    try {
        // Fetch existing file information
        const existingFilesQuery = 'SELECT license, registrationImage, insuranceCard, taxReceipts FROM vehicles WHERE id = ?';
        const existingFiles = await new Promise((resolve, reject) => {
            db.query(existingFilesQuery, [vehicleId], (err, result) => {
                if (err) reject(err);
                else resolve(result[0]);
            });
        });

        const filesToRemove = removedFiles || {};

        // Remove specified files from the filesystem and update existingFilesResult accordingly
        const deletionPromises = [];
        Object.entries(filesToRemove).forEach(([fileType, fileNames]) => {
            if (!existingFiles[fileType]) return; // Skip if no existing files of this type
        
            const currentFileNames = existingFiles[fileType].split(',');
            const updatedFileNames = currentFileNames.filter(f => !fileNames.includes(f)).join(',');
        
            existingFiles[fileType] = updatedFileNames; // Update with the filenames removed
        });

        await Promise.all(deletionPromises);


        // Prepare to update both file and non-file fields
        let updateFields = [];
        const queryParams = [];

        ['license', 'registrationImage', 'insuranceCard', 'taxReceipts'].forEach(fileType => {
            if (req.files[fileType] && req.files[fileType].length > 0) {
                const newFilenames = req.files[fileType].map(file => file.filename).join(',');
                const existingFilenames = existingFiles[fileType] ? existingFiles[fileType].split(',').filter(f => !filesToRemove[fileType] || !filesToRemove[fileType].includes(f)).join(',') + ',' : '';
                updateFields.push(`${fileType} = ?`);
                queryParams.push(existingFilenames + newFilenames);
            } else if (existingFiles[fileType]) {
                // If no new files for this type, but existing filenames are present after deletion
                updateFields.push(`${fileType} = ?`);
                queryParams.push(existingFiles[fileType]);
            }
        });

        updateFields = updateFields.concat(['vehicleno = ?', 'vehicletype = ?', 'ownership = ?', 'fuelType = ?', 'leasedliability = ?', 'cylinderCapacity = ?', 'insuranceCompany = ?', 'taxPayer = ?']);
        queryParams.push(vehicleno, vehicletype, ownership, fuelType, leasedliability, cylinderCapacity, insuranceCompany,taxPayer, vehicleId);

            const updateVehicleQuery = `UPDATE vehicles SET ${updateFields.join(', ')} WHERE id = ?`;
            await new Promise((resolve, reject) => {
                db.query(updateVehicleQuery, queryParams, (err, result) => {
                    if (err) {
                        console.error("Query Error:", err);
                        return res.json({ success: false, message: 'Database update failed.' });
                    }
                    console.log("Update Result:", result);
                    if(result.affectedRows > 0) {
                        return res.json({ success: true, message: 'Vehicle details updated successfully.' });
                    } else {
                        // This might indicate that the vehicleId doesn't match any records, or no data was changed.
                        return res.json({ success: false, message: 'No rows updated. Check if the vehicleId is correct or the data differs from existing records.' });
                    }
                });
            });
    } catch (error) {
        console.error('Error in vehicle update process:', error);
        res.json({ success: false, message: 'Failed to update the vehicle.' });
    }
});

app.post('/vehicles/vehicleDetails/viewVehicles', (req, res) => {
    const { id } = req.body;

    let vehicleSql = "SELECT * FROM vehicles";
    
    if (id) {
      vehicleSql = `SELECT * FROM vehicles WHERE id = ${id}`;
    }
  
    db.query(vehicleSql, (err, vehicleData) => {
      if (err) {
        console.error('Database Error (Vehicles)', err);
        return res.json({ success: false, error: "Server Side Error (Vehicles)" });
      } else if (!vehicleData[0]) {
        return res.status(404).json({ success: false, error: "No vehicle found for the provided ID" });
      }
      else {
        return res.json({ success: true, vehicle: vehicleData[0] }); // Assuming you expect a single vehicle
      }
    });
});

app.get('/vehicles/vehicleDetails/viewVehicles/:id', (req, res) => {
    const { id } = req.params;
    const { types } = req.query; // Use req.query to get the type parameter from the query string
    
    if (!id || !types) {
        return res.json({ success: false, error: "No ID or type provided" });
    }
    
        const vehicleSql = `SELECT license, registrationImage, insuranceCard, taxReceipts FROM vehicles WHERE id = ?`;
        
        db.query(vehicleSql,[id], (err, vehicleData) => {
            if (err) {
                console.error('Database Error (Vehicles)', err);
                return res.status(500).json({ success: false, error: "Server Side Error (Vehicles)" });
            }
            if (!vehicleData[0]) {
                return res.status(404).json({ success: false, error: "No image found for the provided ID" });
            }

            const licenseImages = vehicleData[0].license.split(',');
            const registrationImage = vehicleData[0].registrationImage.split(',');
            const insuranceCardImages = vehicleData[0].insuranceCard.split(',');
            const taxReceiptsImages = vehicleData[0].taxReceipts.split(',');
            res.json({success: true,vehicle: {license: licenseImages, registrationImage: registrationImage, insuranceCard: insuranceCardImages, taxReceipts: taxReceiptsImages},
            });
        });
});

app.post('/vehicles/vehicleDetails/viewTaxPayer', (req, res) => {
    const { vehicleno } = req.body;

    let vehicleSql = "SELECT * FROM vehicles WHERE vehicleno = ?";
    
    db.query(vehicleSql, [vehicleno], (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ success: false, error: "Server Side Error (Vehicles)" });
        } else if (vehicleData.length === 0) {
            return res.status(404).json({ success: false, error: "No vehicle found with the provided number" });
        }
        else {
            return res.json({ success: true, vehicle: vehicleData[0] }); // Assuming you expect a single vehicle
        }
    });
});

app.post('/vehicles/vehicleSecurity', (req, res) => {
    const { vehicleno, registrationDate, originalOwner, key } = req.body;
    const vehicleSql = "INSERT INTO vehiclessecurity ( vehicleno, registrationDate,originalOwner, `key` ) VALUES (?, ?, ?, ?)";
    
    const vehiclesecurityDetails = [ vehicleno, registrationDate,originalOwner, key ];

    db.query(vehicleSql, vehiclesecurityDetails, (err, data) => {
        if(err) {
            return res.json({loginStatus: false, Error: "An error occurred while processing your request"});
        }else if(data.affectedRows > 0){
            return res.json({loginStatus: true, Status: "Trip details inserted successfully"});
        }else{
            return res.json({loginStatus: false, Error: "Failed to insert trip details"});
        }
    })  
});

app.post('/vehicles/vehicleSecurity/originalDocumentsSubmit', (req, res) => {
    const { vehicleno, documentName, reason, issuedDate, issuedBy, issuedTo, receivedDate } = req.body;
    const documentSql = "INSERT INTO originaldocuments (  vehicleno, documentName, reason, issuedDate, issuedBy, issuedTo, receivedDate ) VALUES (?, ?, ?, ?, ?, ?)";
    
    const documentssecurityDetails = [ vehicleno, documentName, reason, issuedDate, issuedBy, issuedTo, receivedDate ];

    db.query(documentSql, documentssecurityDetails, (err, data) => {
        if(err) {
            return res.json({success: false, message: "An error occurred while processing your request"});
        } else if(data.affectedRows > 0){
            return res.json({success: true, message: "Documents details inserted successfully"});
        } else {
            return res.json({success: false, message: "Failed to insert documents details"});
        }
    })  
});

app.post('/vehicles/vehicleSecurity/originalDocumentsRecords', (req, res) => {
    const { vehicleno } = req.body;
    
    let documentsSql = "SELECT * FROM originaldocuments";

    let params = [];

    if (vehicleno) {
        documentsSql += " WHERE vehicleno = ?";
        params.push(vehicleno);

    }

    db.query(documentsSql, params, (err, documentsData) => {
        if (err) {
            console.error('Database Error (Documents)', err);
            return res.json({ success: false, error: "Server Side Error (Documents)" });
        } else {

            return res.json({ success: true, documents: documentsData });
        }
    });
});


app.post('/vehicles/vehicleSecurity/editOriginalDocumentsRecords', (req, res) => {
    const { vehicleno, documentName,receivedDate } = req.body;

    // Check if new password and confirm password match
    if (receivedDate === null) {
        return res.status(400).json('Please fill the Received Date');
    }

    // Update the password and confirm password in the database
    db.query(
        'UPDATE originaldocuments SET receivedDate = ? WHERE vehicleno = ? AND documentName = ?', 
        [ receivedDate, vehicleno, documentName], // Note the order of parameters here
        (err, result) => {
          if (err) {
              console.error(err);
              return res.status(500).json('Error updating Document Details');
          }
          console.log('Document Details updated successfully for vehicle number:', vehicleno);
          res.json('Document Details updated successfully');
      });
});


function sendNotificationEmail(vehicleno, endDate, notificationType) {
    const formattedEndDate = new Date(endDate).toDateString();

    const notificationTypeText = {
        'revenue': 'Revenue License',
        'insurance': 'Insurance',
        'tax': 'Tax'
    }[notificationType] || 'Follow Up';
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'kalani@tadlanka.com , dilhara@tadlanka.com', // replace with admin's email
        subject: `Vehicle ${notificationTypeText} Expire Date Alert for Vehicle no ${vehicleno}`,
        text: `The expire date for the vehicle no ${vehicleno}'s ${notificationTypeText} is approaching. It is scheduled for ${formattedEndDate}.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending notification email:', error);
        } else {
            console.log('Notification email sent:', info.response);
        }
    });
}

app.post('/vehicles/followupDetails', (req, res) => {
    const { vehicleno, revenueStartDate, revenueEndDate, insuranceStartDate, insuranceEndDate, taxPayer, taxStartDate, taxEndDate } = req.body;

    const validTaxPayer = taxPayer === 'Yes' ? 1 : 0;

    // Convert empty string dates to null
    const formattedTaxStartDate = taxStartDate || null;
    const formattedTaxEndDate = taxEndDate || null;


    const checkIfExistsQuery = 'SELECT * FROM followup WHERE vehicleno = ?';
    db.query(checkIfExistsQuery, [vehicleno], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.json({ loginStatus: false, Error: "An error occurred while checking existing details" });
        }

        if (result.length > 0) {
            // If follow-up details exist, update the existing record
            const updateQuery = `UPDATE followup 
                                 SET revenueStartDate = ?, 
                                     revenueEndDate = ?, 
                                     insuranceStartDate = ?, 
                                     insuranceEndDate = ?, 
                                     taxPayer = ?, 
                                     taxStartDate = ?, 
                                     taxEndDate = ? 
                                 WHERE vehicleno = ?`;
            const updateParams = [
                revenueStartDate,
                revenueEndDate,
                insuranceStartDate,
                insuranceEndDate,
                validTaxPayer,
                formattedTaxStartDate,
                formattedTaxEndDate,
                vehicleno
            ];

            db.query(updateQuery, updateParams, (updateErr, updateResult) => {
                if (updateErr) {
                    console.error('Database error:', updateErr);
                    return res.json({ loginStatus: false, Error: "Failed to update follow-up details" });
                }
                return res.json({ loginStatus: true, Message: "Follow-up details updated successfully" });
            });
        } else {
            const vehicleSql = "INSERT INTO followup (vehicleno, revenueStartDate, revenueEndDate, insuranceStartDate, insuranceEndDate, taxPayer, taxStartDate, taxEndDate) VALUES (?,?, ?, ?, ?, ?, ?, ?)";
            const vehiclefollowUpDetails = [vehicleno, revenueStartDate, revenueEndDate, insuranceStartDate, insuranceEndDate, validTaxPayer, formattedTaxStartDate, formattedTaxEndDate];

            db.query(vehicleSql, vehiclefollowUpDetails, (err, data) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.json({ loginStatus: false, Error: "An error occurred while processing your request" });
                } else if (data.affectedRows > 0) {
                    return res.json({ loginStatus: true, Message: "Follow-up details added successfully" });
                } else {
                    return res.json({ loginStatus: false, Error: "Failed to insert trip details" });
                }
            });
        }
    });
});

function checkAndSendNotification(vehicleno, endDate, notificationType, currentDate) {
    const end = new Date(endDate);
    const diffTime = end.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Send email if the difference is exactly 15 days
    if (diffDays === 15) {
        sendNotificationEmail(vehicleno, endDate, notificationType);
    }
}

cron.schedule('00 10 * * *', () => {
    console.log('Running a task every day at 10.00 AM');
    const currentDate = new Date();
    const sql = "SELECT vehicleno, revenueEndDate, insuranceEndDate, taxEndDate FROM followup"; // Add your conditions here
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching vehicles:', err);
        } else {
            results.forEach(vehicle => {
                checkAndSendNotification(vehicle.vehicleno, vehicle.revenueEndDate, 'revenue', currentDate);
                checkAndSendNotification(vehicle.vehicleno, vehicle.insuranceEndDate, 'insurance', currentDate);
                checkAndSendNotification(vehicle.vehicleno, vehicle.taxEndDate, 'tax', currentDate);
            });
        }
    });
});

app.post('/sendEmailNotification', (req, res) => {
    const { vehicleno, endDate, notificationType } = req.body;

    sendNotificationEmail(vehicleno, endDate, notificationType);

    res.status(200).json({ success: true, message: 'Email notification sent successfully' });
});

app.post('/vehicles/historyDetails/viewFuelType', (req, res) => {
    const { vehicleno } = req.body;
    let vehicleSql = "SELECT * FROM vehicles WHERE vehicleno = ?";

    db.query(vehicleSql, [vehicleno], (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ success: false, error: "Server Side Error (Vehicles)" });
        } else if (vehicleData.length === 0) {
            return res.status(404).json({ success: false, error: "No vehicle found with the provided number" });
        } else {
            return res.json({ success: true, fuel: vehicleData[0] });
        }
    });
});

app.post('/vehicles/historyDetails/fuelUsage', (req, res) => {
    const { vehicleno, date, fuelType, fuelPumped, cost} = req.body;
    const fuelSql = "INSERT INTO fuel ( vehicleno, date, fuelType, fuelPumped, cost ) VALUES (?, ?, ?, ?, ?)";
    
    const fuelDetails = [ vehicleno, date, fuelType, parseFloat(fuelPumped), parseFloat(cost) ];

    db.query(fuelSql, fuelDetails, (err, data) => {
        if(err) {
            return res.json({loginStatus: false, Error: "An error occurred while processing your request"});
        }else if(data.affectedRows > 0){
            return res.json({loginStatus: true, Status: "Fuel details inserted successfully"});
        }else{
            return res.json({loginStatus: false, Error: "Failed to insert Fuel details"});
        }
    })  
});

app.post('/records/fuelRecords', (req, res) => {
    const { vehicleno, startDate, endDate } = req.body;

    let fuelSql = "SELECT vehicleno, date, fuelType, fuelPumped, cost FROM fuel WHERE 1";
    let queryParams = [];

    if (vehicleno) {
        fuelSql += " AND vehicleno = ?";
        queryParams.push(vehicleno);
    }
    if (startDate) {
        fuelSql += " AND date >= ?";
        queryParams.push(startDate);
    }
    if (endDate) {
        fuelSql += " AND date <= ?";
        queryParams.push(endDate);
    }
    
    db.query(fuelSql, queryParams, (err, data) => {
        if (err) {
            console.error('Database Error (fuel)', err);
            return res.json({ success: false, error: "Server Side Error (fuel)" });
        } else {
            return res.json({ success: true, fuel: data });
        }
    })  
});

app.post('/records/tripsRecords', (req, res) => {
    const { vehicleno, startDate, endDate } = req.body;

    let vehicleSql = "SELECT drivername, start, end, vehicleno, startDateTime, endDateTime, location, startmeter, endmeter, (endmeter - startmeter) AS meterGap FROM trips WHERE 1";

    const params = [];
    if (vehicleno) {
        vehicleSql += " AND vehicleno=?";
        params.push(vehicleno);
    }

    if (startDate && endDate) {
        vehicleSql += " AND (startDateTime BETWEEN ? AND ? OR endDateTime BETWEEN ? AND ? OR (startDateTime < ? AND endDateTime > ?))";
        params.push(startDate, endDate, startDate, endDate, startDate, endDate);
    }

    db.query(vehicleSql, params, (err, tripData) => {
        if (err) {
            console.error('Database Error (Trips)', err);
            return res.json({ success: false, error: "Server Side Error (Trips)" });
        } else {
            return res.json({ success: true, trips: tripData });
        }
    });
});

app.post('/records/attendanceRecords', (req, res) => {
    const { drivername, startDate, endDate } = req.body;

    let attendanceSql = "SELECT drivername, checkIn, checkOut, checkInDateTime, checkOutDateTime, checkInLocation, checkOutLocation FROM attendance WHERE 1";

    const params = [];
    if (drivername) {
        attendanceSql += " AND drivername=?";
        params.push(drivername);
    }

    if (startDate && endDate) {
        attendanceSql += " AND (checkInDateTime BETWEEN ? AND ? OR checkOutDateTime BETWEEN ? AND ? OR (checkInDateTime < ? AND checkOutDateTime > ?))";
        params.push(startDate, endDate, startDate, endDate, startDate, endDate);
    }

    db.query(attendanceSql, params, (err, attendnceData) => {
        if (err) {
            console.error('Database Error (Attendance)', err);
            return res.json({ success: false, error: "Server Side Error (Attendance)" });
        } else {
            return res.json({ success: true, attendance: attendnceData });
        }
    });
});

app.post('/records/vehicleRecords', (req, res) => {
    const { vehicleno } = req.body;

    let vehicleSql = "SELECT vehicleno, vehicletype, ownership, fuelType, leasedliability, cylinderCapacity FROM vehicles";
    let securitySql = "SELECT registrationDate,originalOwner, `key` FROM vehiclessecurity ";
    let followupSql = "SELECT revenueStartDate, revenueEndDate, insuranceStartDate, insuranceEndDate, taxStartDate, taxEndDate FROM followup ";
    let maintenanceSql = "SELECT date, maintenanceType, serviceMilage, reason, otherVehicleMaintenance FROM maintenance ";

    let params = [];

    if (vehicleno) {
        vehicleSql += " WHERE vehicleno = ?";
        securitySql += " WHERE vehicleno = ?";
        followupSql += " WHERE vehicleno = ?";
        maintenanceSql += "WHERE vehicleno =?";
        params = [vehicleno];
    }

    db.query(vehicleSql, params, (err, vehicleData) => {
        if (err) {
            console.error('Database Error (Vehicles)', err);
            return res.json({ success: false, error: "Server Side Error (Vehicles)" });
        }
        db.query(securitySql, params, (err, securityData) => {
            if (err) {
                console.error('Database Error (Security)', err);
                return res.json({ success: false, error: "Server Side Error (Security)" });
            }

            db.query(followupSql, params, (err, followupData) => {
                if (err) {
                    console.error('Database Error (Followup)', err);
                    return res.json({ success: false, error: "Server Side Error (Followup)" });
                }
                db.query(maintenanceSql, params, (err, maintenanceData) => {
                    if (err) {
                        console.error('Database Error (Followup)', err);
                        return res.json({ success: false, error: "Server Side Error (Followup)" });
                    }

                    // Combine data from all tables
                    const vehicles = {
                        vehicles: vehicleData.map(row => ({ ...row })),
                        followup: followupData.map(row => ({ ...row })),
                        security: securityData.map(row => ({ ...row })),
                        maintenance: maintenanceData.map(row => ({...row})),
                    };

                    return res.json({ success: true, vehicles });
                });
            });
        });
    });
});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, `public/image/maintenanceBill`);
    },
    filename: (req, file, cb) => {
        const maintenanceType = req.body.maintenanceType;
        const timestamp = new Date().getTime(); // Add timestamp to make filenames unique
        cb(null, `${file.fieldname}_${maintenanceType}_${timestamp}${path.extname(file.originalname)}`);
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        if (ext !== '.jpg' && ext !== '.png' && ext !== '.jpeg' && ext !== '.pdf') {
            return cb(res.status(400).end('only jpg, png, jpeg & pdf are allowed'), false);
        }
        cb(null, true)
    }
});

const upload2 = multer({ 
    storage: storage2,
    limits: { fileSize: 1024 * 1024 * 5 },
});

app.post('/vehicles/historyDetails/vehicleMaintenance', upload2.array('maintenanceBill'), (req, res) => {
    const { vehicleno, date, maintenanceType, serviceMilage, reason, otherVehicleMaintenance } = req.body;
    
    const maintenanceBill = req.files ? req.files.map(file => file.filename) : [];

    if (!vehicleno || !date || !maintenanceType ) {
        return res.json({ success: false, error: 'Please provide all required information' });
    }

    const maintenanceSql = "INSERT INTO maintenance ( vehicleno, date, maintenanceType, serviceMilage, reason, otherVehicleMaintenance, maintenanceBill ) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    const maintenanceDetails = [ vehicleno, date, maintenanceType, serviceMilage, reason, otherVehicleMaintenance, maintenanceBill.join(',')];

    db.query(maintenanceSql, maintenanceDetails, (err, data) => {
        if(err) {
            return res.json({loginStatus: false, Error: "An error occurred while processing your request"});
        }else if(data.affectedRows > 0){
            return res.json({loginStatus: true, Status: "Maintenance details inserted successfully"});
        }else{
            return res.json({loginStatus: false, Error: "Failed to insert Maintenance details"});
        }
    })  
});

app.post('/historyRecords', (req, res) => {
    return res.json({Status: "Success", username: req.username});
})

app.post('/user', (req, res) => {
    const sql = "SELECT * FROM user WHERE username=? AND password=?";
    db.query(sql, [req.body.username, req.body.password], (err, data) => {
        if(err) return res.json({loginStatus:  "Server Side Error"})
        if(data.length > 0){
            return res.json({loginStatus: true})
        }else{
            return res.json({loginStatus: "Wrong username and password"});
        }
    })
})

app.post('/user/reset-password', async (req, res) => {
    const { username, newPassword, confirmPassword } = req.body;

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    // Update the password and confirm password in the database
    db.query('UPDATE user SET password = ?, confirmpassword = ? WHERE username = ?', [newPassword, confirmPassword, username], (err, result) => {
        if (err) {
            // Handle SQL errors
            console.error(err);
            return res.status(500).send('Error updating password');
        }

        console.log('Password updated successfully for user:', username);
        res.send('Password updated successfully');
    });
});

app.post('/admin/home/register/user/viewUser', (req, res) => {
    const userSql = "SELECT * FROM user";

    db.query(userSql, (err, userData) => {
        if (err) {
            console.error('Database Error (User)', err);
            return res.json({ success: false, error: "Server Side Error (User)" });
        } else {
            return res.json({ success: true, user: userData });
        }
    });
});

app.post('/admin/home/register/user/deleteUser', (req, res) => {

    const { id } = req.body;
    const userSql = "DELETE FROM user WHERE id=?";

    db.query(userSql, [id], (err, result) => {
        if (err) {
          console.error('Database Error (User)', err);
          return res.json({ success: false, error: "Server Side Error (User)" });
        } else {
          // After deletion, fetch the updated list of admins
          const fetchUserSql = "SELECT * FROM user";
          db.query(fetchUserSql, (err, userData) => {
            if (err) {
              console.error('Database Error (User)', err);
              return res.json({ success: false, error: "Server Side Error (User)" });
            } else {
              return res.json({ success: true, user: userData });
            }
          });
        }
      });
    });


app.post('/user/home', (req, res) => {
    return res.json({Status: "Success", username: req.username});
})

app.post('/user/home/trips', (req, res) => {
    const { username, tripmode, dateTime, location, reason } = req.body;

    console.log(req.body);
    if (!username || !tripmode) {
        return res.json({ loginStatus2: false, message: "Missing required fields" });
    }

    if (tripmode === 'Start') {
        const checkTripSql = "SELECT * FROM usertrips WHERE username = ? AND endDateTime IS NULL";
        db.query(checkTripSql, [username], (err, ongoingTrips) => {
            if (err) {
                console.error("SQL Error when checking for ongoing trips:", err);
                return res.json({ loginStatus2: false, message: "An error occurred while checking for ongoing trips." });
            } else if (ongoingTrips.length > 0) {
                console.log("Ongoing trip found for user:", username); // Add more logging here
                return res.json({ loginStatus2: false, message: "You must end your current trip before starting a new one." });
            } else {
                const tripsSql = "INSERT INTO usertrips (username, start, startDateTime, location, reason) VALUES (?, 'Start', ?, ?, ?)";

                db.query(tripsSql, [username, dateTime, location, reason], (err, result) => {
                    if (err) {
                        console.error("SQL Error while inserting start trip details:", err);
                        return res.json({ loginStatus2: false, message: "An error occurred while inserting start trip details." });
                    }

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        },
                    });

                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: 'kalani@tadlanka.com , dilhara@tadlanka.com', // replace with admin's email
                        subject: 'New Trip Started',
                        text: `A new trip has started by ${username}.
                               Please review the details,
                               Start Date and Time: ${dateTime},
                               Location: ${location},
                               Reason: ${reason},`
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error('Error sending notification email:', error);
                        } else {
                            console.log('Notification email sent:', info.response);
                        }
                    });
                    return res.json({ loginStatus2: true, tripId: result.insertId });
                });
            }
        });
    } else if (tripmode === 'End') {
        const findTripSql = "SELECT * FROM usertrips WHERE username = ? AND start = 'Start' AND endDateTime IS NULL ORDER BY startDateTime DESC LIMIT 1";
        db.query(findTripSql, [username], (err, tripDetails) => {
            if (err) {
                console.error("SQL Error while fetching trip details:", err);
                return res.json({ loginStatus2: false, message: "An error occurred while fetching trip details." });
            }
            if (tripDetails.length === 0) {
                return res.json({ loginStatus2: false, message: "Ongoing trip not found or already ended." });
            }

            const trip = tripDetails[0];
            const updateTripSql = "UPDATE usertrips SET end='End', endDateTime = ? WHERE id = ? AND username = ?";
            db.query(updateTripSql, [dateTime, trip.id, username], (updateErr, result) => {
                if (updateErr) {
                    console.error("Update Error:", updateErr);
                    return res.json({ loginStatus2: false, message: "An error occurred while ending the trip." });
                }
                if (result.affectedRows === 0) {
                    return res.json({ loginStatus2: false, message: "Trip not found or could not be ended." });
                }

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: 'kalani@tadlanka.com , dilhara@tadlanka.com', // replace with admin's email
                    subject: 'End Trip',
                    text: `A started trip has been ended by ${username}.
                           Please review the details,
                           End Date and Time: ${dateTime},
                           Location: ${location},`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending notification email:', error);
                    } else {
                        console.log('Notification email sent:', info.response);
                    }
                });

                res.json({
                    loginStatus2: true,
                    tripDetails: {
                        startDateTime: trip.startDateTime,
                        startLocation: trip.location,
                    },
                    tripId: trip.id
                });
            });
        });
    } else {
        return res.json({ loginStatus2: false, message: "Invalid tripmode value" });
    }
});


app.get('/user/home/latest-start-trip/:username', (req, res) => {
    const username = req.params.username;

    const query ="SELECT * FROM usertrips WHERE username = ? ORDER BY startDateTime DESC LIMIT 1";

    db.query(query, [username], (err, result) => {
        if (err) {
            console.error("SQL Error while fetching latest trip details:", err);
            return res.json({ Error: "An error occurred while fetching the latest trip details." });
        }
        if (result.length === 0) {
            return res.json({ Error: "No trip found for this driver." });
        }

        const latestTrip = result[0];

        // Check if the latest trip has already ended
        if (latestTrip.endDateTime !== null) {
            // If yes, return an appropriate message indicating there are no ongoing trips
            return res.json({ Message: "The latest trip has already ended. There are no ongoing trips." });
        } else {
            // If the latest trip is still ongoing, return its details
            res.json({
                Status: "Success",
                LatestStartDetails: latestTrip
            });
        }
    });
});


app.post('/logout', (req,res) => {
    return res.json({Status: "Success", username: req.username});
})


app.listen(8081, () => {
    console.log("Listening...");
})