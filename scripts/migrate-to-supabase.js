require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { saveChats, saveLeads, saveConfig, saveTrainingEntries, usingSupabase } = require("../src/storage");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8"));
}

async function main() {
  if (!usingSupabase()) {
    throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.");
  }

  await saveConfig(readJson("data/config.json"));
  await saveChats(readJson("data/chats.json"));
  await saveLeads(readJson("data/leads.json"));
  await saveTrainingEntries(readJson("data/training.json"));

  console.log("Migration abgeschlossen: JSON-Daten wurden nach Supabase uebertragen.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
