const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
};

async function migratePasswords() {
  let connection;

  try {
    console.log("กำลังเชื่อมต่อ Oracle...");

    connection = await oracledb.getConnection(dbConfig);

    console.log("เชื่อมต่อ Oracle สำเร็จ");

    // ดึง EMPID และรหัสผ่านทั้งหมด
    const result = await connection.execute(`
      SELECT EMPID, EMPPASSWORD
      FROM MUTEMP
      WHERE EMPPASSWORD IS NOT NULL
    `);

    console.log(`พบข้อมูล ${result.rows.length} รายการ`);
    console.log("--------------------------------");

    for (const row of result.rows) {
      const empId = row[0];
      const oldPassword = row[1];

      // ถ้าเป็น bcrypt hash อยู่แล้ว ให้ข้าม
      if (
        oldPassword.startsWith("$2a$") ||
        oldPassword.startsWith("$2b$") ||
        oldPassword.startsWith("$2y$")
      ) {
        console.log(`${empId} : เป็น Hash อยู่แล้ว -> ข้าม`);
        continue;
      }

      // Hash password เดิม
      const hashedPassword = await bcrypt.hash(oldPassword, 10);

      // Update กลับเข้า Oracle
      await connection.execute(
        `
        UPDATE MUTEMP
        SET EMPPASSWORD = :hashedPassword
        WHERE EMPID = :empId
        `,
        {
          hashedPassword,
          empId,
        },
      );

      console.log(`${empId} : Hash สำเร็จ`);
    }

    // บันทึกการเปลี่ยนแปลง
    await connection.commit();

    console.log("--------------------------------");
    console.log("Hash password สำเร็จทั้งหมด");
    console.log("ข้อมูลถูกบันทึกลง Oracle แล้ว");
  } catch (error) {
    console.error("--------------------------------");
    console.error("เกิดข้อผิดพลาด:");
    console.error(error);

    // ถ้าเกิด Error ให้ยกเลิกการเปลี่ยนแปลง
    if (connection) {
      try {
        await connection.rollback();
        console.log("Rollback สำเร็จ");
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log("ปิดการเชื่อมต่อ Oracle แล้ว");
      } catch (error) {
        console.error("Close Connection Error:", error);
      }
    }
  }
}

migratePasswords();
