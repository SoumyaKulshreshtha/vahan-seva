const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend if needed
app.use(express.static(path.join(__dirname, "public")));

// SQLite DB
const db = new sqlite3.Database("./vahanseva.db");

// ---------------------- DB INIT ----------------------
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT CHECK(role IN ('user','mechanic')) NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      location TEXT,
      vehicle_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS mechanics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_name TEXT,
      shop_address TEXT,
      services TEXT,
      experience_years INTEGER,
      aadhar_uploaded INTEGER DEFAULT 0,
      shop_photo_uploaded INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 1,
      rating REAL DEFAULT 4.5,
      distance_km REAL DEFAULT 2.0,
      price_service TEXT DEFAULT '0',
      price_wash TEXT DEFAULT '0',
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mechanic_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      problem TEXT,
      preferred_datetime TEXT,
      status TEXT CHECK(status IN ('Requested','Confirmed','Completed','Rejected')) DEFAULT 'Requested',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(mechanic_id) REFERENCES mechanics(id)
    )
  `);

    // Seed mechanics (only if no mechanics exist)
    db.get(`SELECT COUNT(*) as count FROM mechanics`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            seedData();
        }
    });
});

function seedData() {
    db.run(
        `INSERT OR IGNORE INTO users (role, full_name, phone, location) VALUES
    ('mechanic', 'Ramesh', '9000000001', 'Mandi'),
    ('mechanic', 'Sharma', '9000000002', 'Mandi'),
    ('mechanic', 'Aman',   '9000000003', 'Mandi')
  `,
        () => {
            db.all(`SELECT id FROM users WHERE role='mechanic' ORDER BY id`, (err, rows) => {
                if (err) return;

                const [u1, u2, u3] = rows.map((r) => r.id);

                db.run(
                    `INSERT INTO mechanics (user_id, shop_name, shop_address, services, experience_years, rating, distance_km) VALUES
          (?, 'Ramesh Auto Works', 'Near Bus Stand', 'General Service,Brake Repair,Puncture', 8, 4.8, 2.1),
          (?, 'Sharma Bike Service', 'Main Market Road', 'Oil Change,Chain Repair,Brake Repair', 10, 4.6, 3.6),
          (?, 'Aman Garage', 'Village Chowk', 'Engine Repair,Clutch Repair,General Service', 6, 4.3, 5.0)
        `,
                    [u1, u2, u3]
                );
            });
        }
    );
}

// ---------------------- HELPERS ----------------------
function ok(res, data) {
    res.json({ success: true, data });
}

function fail(res, message, status = 400) {
    res.status(status).json({ success: false, message });
}

// ---------------------- API ROUTES ----------------------

/**
 * Simple login/register using phone
 * Body: { role: "user"|"mechanic", full_name, phone, location, vehicle_type }
 */
app.post("/api/auth/register", (req, res) => {
    const { role, full_name, phone, location, vehicle_type } = req.body;

    if (!role || !full_name || !phone) return fail(res, "role, full_name and phone are required");

    db.run(
        `INSERT INTO users (role, full_name, phone, location, vehicle_type)
     VALUES (?, ?, ?, ?, ?)`,
        [role, full_name, phone, location || "", vehicle_type || ""],
        function (err) {
            if (err) {
                // If already exists, return existing
                db.get(`SELECT * FROM users WHERE phone=?`, [phone], (e2, user) => {
                    if (e2 || !user) return fail(res, "User already exists but cannot fetch user");
                    return ok(res, user);
                });
            } else {
                db.get(`SELECT * FROM users WHERE id=?`, [this.lastID], (e2, user) => {
                    if (e2) return fail(res, "Registered but fetch failed");
                    return ok(res, user);
                });
            }
        }
    );
});

/**
 * Mechanic details creation
 * Body: { user_id, shop_name, shop_address, services, experience_years }
 */
app.post("/api/mechanic/create", (req, res) => {
    const { user_id, shop_name, shop_address, services, experience_years } = req.body;
    if (!user_id || !shop_name || !shop_address) return fail(res, "user_id, shop_name, shop_address required");

    db.run(
        `INSERT INTO mechanics (user_id, shop_name, shop_address, services, experience_years, verified)
     VALUES (?, ?, ?, ?, ?, 0)`,
        [user_id, shop_name, shop_address, services || "", parseInt(experience_years || "0")],
        function (err) {
            if (err) return fail(res, err.message);
            db.get(`SELECT * FROM mechanics WHERE id=?`, [this.lastID], (e2, row) => {
                if (e2) return fail(res, "Created but fetch failed");
                return ok(res, row);
            });
        }
    );
});

/**
 * List mechanics (for Customer)
 */
app.get("/api/mechanics", (req, res) => {
    db.all(
        `
    SELECT
      m.*,
      u.full_name as mechanic_name,
      u.phone as mechanic_phone,
      u.location
    FROM mechanics m
    JOIN users u ON u.id = m.user_id
    ORDER BY m.rating DESC
    `,
        (err, rows) => {
            if (err) return fail(res, err.message);
            return ok(res, rows);
        }
    );
});

/**
 * Create booking/service request
 * Body: { user_id, mechanic_id, service_type, problem, preferred_datetime }
 */
app.post("/api/bookings/create", (req, res) => {
    const { user_id, mechanic_id, service_type, problem, preferred_datetime } = req.body;
    if (!user_id || !mechanic_id || !service_type)
        return fail(res, "user_id, mechanic_id and service_type required");

    db.run(
        `
    INSERT INTO bookings (user_id, mechanic_id, service_type, problem, preferred_datetime, status)
    VALUES (?, ?, ?, ?, ?, 'Requested')
    `,
        [user_id, mechanic_id, service_type, problem || "", preferred_datetime || ""],
        function (err) {
            if (err) return fail(res, err.message);
            db.get(`SELECT * FROM bookings WHERE id=?`, [this.lastID], (e2, row) => {
                if (e2) return fail(res, "Created but fetch failed");
                return ok(res, row);
            });
        }
    );
});

/**
 * User bookings
 */
app.get("/api/bookings/user/:user_id", (req, res) => {
    const { user_id } = req.params;

    db.all(
        `
    SELECT
      b.*,
      m.shop_name,
      u.full_name as mechanic_name,
      u.phone as mechanic_phone
    FROM bookings b
    JOIN mechanics m ON m.id = b.mechanic_id
    JOIN users u ON u.id = m.user_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
    `,
        [user_id],
        (err, rows) => {
            if (err) return fail(res, err.message);
            return ok(res, rows);
        }
    );
});

/**
 * Mechanic bookings
 */
app.get("/api/bookings/mechanic/:mechanic_id", (req, res) => {
    const { mechanic_id } = req.params;

    db.all(
        `
    SELECT
      b.*,
      u.full_name as user_name,
      u.phone as user_phone,
      u.location as user_location
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    WHERE b.mechanic_id = ?
    ORDER BY b.created_at DESC
    `,
        [mechanic_id],
        (err, rows) => {
            if (err) return fail(res, err.message);
            return ok(res, rows);
        }
    );
});

/**
 * Mechanic updates booking status
 * Body: { status: "Confirmed"|"Completed"|"Rejected" }
 */
app.post("/api/bookings/update-status", (req, res) => {
    const { booking_id, status } = req.body;
    if (!booking_id || !status) return fail(res, "booking_id and status required");

    db.run(
        `UPDATE bookings SET status=? WHERE id=?`,
        [status, booking_id],
        function (err) {
            if (err) return fail(res, err.message);
            db.get(`SELECT * FROM bookings WHERE id=?`, [booking_id], (e2, row) => {
                if (e2) return fail(res, "Updated but fetch failed");
                return ok(res, row);
            });
        }
    );
});
// ---------------------- ADMIN ROUTES ----------------------

// Admin login
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "vahanseva123") {
        return ok(res, { token: "admin-secret-token" });
    }
    return fail(res, "Invalid credentials", 401);
});

// Get all pending mechanics (verified = 0)
app.get("/api/admin/pending", (req, res) => {
    const token = req.headers["x-admin-token"];
    if (token !== "admin-secret-token") return fail(res, "Unauthorized", 401);

    db.all(`
        SELECT m.*, u.full_name, u.phone, u.location
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        WHERE m.verified = 0
        ORDER BY m.id DESC
    `, (err, rows) => {
        if (err) return fail(res, err.message);
        return ok(res, rows);
    });
});

// Approve a mechanic
app.post("/api/admin/approve", (req, res) => {
    const token = req.headers["x-admin-token"];
    if (token !== "admin-secret-token") return fail(res, "Unauthorized", 401);

    const { mechanic_id } = req.body;
    if (!mechanic_id) return fail(res, "mechanic_id required");

    db.run(`UPDATE mechanics SET verified = 1 WHERE id = ?`, [mechanic_id], function(err) {
        if (err) return fail(res, err.message);
        return ok(res, { mechanic_id, status: "approved" });
    });
});
// ---------------------- SERVER ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
