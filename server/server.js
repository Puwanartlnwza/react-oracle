const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
};

async function getConnection() {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error("Oracle Connection Error:");
    console.error(error);
    throw error;
  }
}
async function generateEmpId(connection) {
  // ค.ศ. เช่น 2026
  const currentYear = new Date().getFullYear();
  // แปลงเป็ น พ.ศ.
  // 2026 + 543 = 2569
  const buddhistYear = currentYear + 543;
  // เอา 2 หลักสุดท้าย
  // 2569 -> 69
  const yearCode = String(buddhistYear).slice(-2);
  const result = await connection.execute(
    `SELECT MAX(EMPID) AS MAXID
      FROM MUTEMP
      WHERE EMPID LIKE :prefix`,
    {
      prefix: `EMP${yearCode}%`,
    },
  );
  let runningNumber = 1;
  if (result.rows[0][0]) {
    const maxId = result.rows[0][0];
    // EMP69001
    // ตัด EMP69 ออก
    // เหลือ 001
    const lastNumber = parseInt(maxId.substring(5), 10);

    runningNumber = lastNumber + 1;
  }
  const runningCode = String(runningNumber).padStart(3, "0");
  console.log(`EMP${yearCode}${runningCode}`);
  return `EMP${yearCode}${runningCode}`;
}
// =====================================================
// GET ALL EMPLOYEES
// =====================================================
app.get("/api/mutemp", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT EMPID,EMPNAME,EMPADDRESS,EMPEMAIL,SALARY
      FROM MUTEMP
      ORDER BY EMPID`,
    );
    const employees = result.rows.map((row) => ({
      empId: row[0],
      empname: row[1],
      empaddress: row[2],
      empemail: row[3],
      salary: row[4],
    }));

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot get employees",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
// =====================================================
// GET EMPLOYEE BY ID
// =====================================================
app.get("/api/mutemp/:id", async (req, res) => {
  let connection;
  try {
    const empId = req.params.id;
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT  EMPID,EMPNAME,EMPADDRESS,EMPEMAIL,SALARY
      FROM MUTEMP
      WHERE EMPID = :empId`,
      {
        empId: empId,
      },
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }
    const row = result.rows[0];
    res.json({
      empId: row[0],
      empname: row[1],
      empaddress: row[2],
      empemail: row[3],
      salary: row[4],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot get employee",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
// =====================================================
// CREATE EMPLOYEE
// =====================================================
app.post("/api/mutemp", async (req, res) => {
  let connection;
  try {
    const { empname, empaddress, empemail, emppassword, salary } = req.body;
    // ตรวจสอบ Password
    if (!emppassword || emppassword.trim() === "") {
      return res.status(400).json({
        message: "Password is required",
      });
    }
    connection = await getConnection();
    // ---------------------------------------------
    // Generate Auto Employee ID
    // ---------------------------------------------
    const empId = await generateEmpId(connection);
    // ---------------------------------------------
    // Hash Password
    // ---------------------------------------------
    const hashedPassword = await bcrypt.hash(emppassword, 10);
    // ---------------------------------------------
    // Insert Data
    // ---------------------------------------------
    await connection.execute(
      `INSERT INTO MUTEMP(EMPID,EMPNAME,EMPADDRESS,EMPEMAIL,EMPPASSWORD,SALARY)
    VALUES(
    :empId,
    :empname,
    :empaddress,
    :empemail,
    :emppassword,
    :salary
    )`,
      {
        empId: empId,
        empname: empname,
        empaddress: empaddress,
        empemail: empemail,
        emppassword: hashedPassword,
        salary: salary,
      },
      {
        autoCommit: true,
      },
    );
    res.status(201).json({
      message: "Employee created successfully",
      empId: empId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot create employee",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
// =====================================================
// UPDATE EMPLOYEE
// =====================================================
app.put("/api/mutemp/:id", async (req, res) => {
  let connection;
  try {
    const empId = req.params.id;
    const { empname, empaddress, empemail, emppassword, salary } = req.body;
    connection = await getConnection();
    // =================================================
    // กรณีมีการเปลี่ยน Password
    // =================================================
    if (emppassword && emppassword.trim() !== "") {
      const hashedPassword = await bcrypt.hash(emppassword, 10);
      await connection.execute(
        `UPDATE MUTEMP SET
        EMPNAME = :empname,
        EMPADDRESS = :empaddress,
        EMPEMAIL = :empemail,
        EMPPASSWORD = :emppassword,
        SALARY = :salary
        WHERE EMPID = :empId`,
        {
          empId: empId,
          empname: empname,
          empaddress: empaddress,
          empemail: empemail,
          emppassword: hashedPassword,
          salary: salary,
        },
        {
          autoCommit: true,
        },
      );
    }
    // =================================================
    // กรณีไม่เปลี่ยน Password
    // =================================================
    else {
      await connection.execute(
        `UPDATE MUTEMP SET
        EMPNAME = :empname,
        EMPADDRESS = :empaddress,
        EMPEMAIL = :empemail,
        SALARY = :salary
        WHERE EMPID = :empId`,
        {
          empId: empId,
          empname: empname,
          empaddress: empaddress,
          empemail: empemail,
          salary: salary,
        },
        {
          autoCommit: true,
        },
      );
    }
    res.json({
      message: "Employee updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot update employee",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
// =====================================================
// DELETE EMPLOYEE
// =====================================================
app.delete("/api/mutemp/:id", async (req, res) => {
  let connection;
  try {
    const empId = req.params.id;
    connection = await getConnection();
    await connection.execute(
      `DELETE FROM MUTEMP 
        WHERE EMPID = :empId`,
      {
        empId: empId,
      },
      {
        autoCommit: true,
      },
    );
    res.json({
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot delete employee",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.get("/api/mutcus", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT CUSID,CUSNAME,CUSADDRESS,CUSTEL,CUSEMAIL 
      FROM mutcustomer
      ORDER BY CUSID`,
    );
    const customer = result.rows.map((row) => ({
      cusId: row[0],
      cusname: row[1],
      cusaddress: row[2],
      custel: row[3],
      cusemail: row[4],
    }));

    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cannot get customer",
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

// =====================================================
// Start Server
// =====================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
========================================
Server running
http://localhost:${PORT}
========================================
`);
});
