import fs from "fs";
import initSqlJs from "sql.js";

async function run() {
  try {
    const fileBytes = fs.readFileSync("data/app.sqlite");
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(fileBytes));
    
    const users = db.exec("SELECT * FROM users");
    console.log("=== USERS ===");
    if (users[0]) {
      users[0].values.forEach(v => console.log(v));
    } else {
      console.log("(No users)");
    }
    
    const histories = db.exec("SELECT * FROM conversation_histories");
    console.log("\n=== CONVERSATION HISTORIES ===");
    if (histories[0]) {
      histories[0].values.forEach(v => console.log(v));
    } else {
      console.log("(No histories)");
    }

    const messages = db.exec("SELECT id, conversation_history_id, sender_type, content, created_at FROM messages");
    console.log("\n=== MESSAGES ===");
    if (messages[0]) {
      messages[0].values.forEach(v => {
        const type = v[2] === 0 ? "USER " : "AGENT";
        const msg = String(v[3]).substring(0, 50) + (String(v[3]).length > 50 ? "..." : "");
        console.log(`[${type}] ${v[4]}: ${msg}`);
      });
    } else {
      console.log("(No messages)");
    }
  } catch (err) {
    console.error(err);
  }
}

run();
