import * as dotenv from 'dotenv';
dotenv.config();
fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY)
  .then(r => r.json())
  .then(j => {
      if (j.error) console.log("API Error:", j.error.message);
      else console.log(j.models.map(m => m.name));
  });
