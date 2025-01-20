const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// SQLite database setup
const db = new sqlite3.Database('chatbot.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    createTables();
  }
});

// Create tables
function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      sender TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      conversation_id TEXT NOT NULL,
      is_question BOOLEAN DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    )
  `);
}

// Chatbot response handler
const generateBotResponse = (message) => {
  const input = message.toLowerCase();
  
  const responses = {
    greeting: {
      patterns: ['hello', 'hi', 'hey', 'greetings'],
      responses: ['Hello! How can I help you today?', 'Hi there! What can I do for you?']
    },
    farewell: {
      patterns: ['bye', 'goodbye', 'see you', 'thanks'],
      responses: ['Goodbye! Have a great day!', 'See you later! Take care!']
    },
    about: {
      patterns: ['who are you', 'what are you', 'what do you do'],
      responses: ['I am a chatbot designed to help answer your questions!', 'I\'m your friendly AI assistant, here to help!']
    },
    help: {
      patterns: ['help', 'support', 'assist'],
      responses: ['I can help you with general questions, information, and basic tasks. What do you need?']
    },
    weather: {
      patterns: ['weather', 'temperature', 'forecast'],
      responses: ['I can\'t check real-time weather, but I can help you find a weather service!']
    },
    default: {
      responses: [
        'I\'m not sure I understand. Could you rephrase that?',
        'Interesting question! Could you provide more details?',
        'I\'m still learning. Could you try asking in a different way?'
      ]
    }
  };

  for (const category in responses) {
    if (responses[category].patterns) {
      for (const pattern of responses[category].patterns) {
        if (input.includes(pattern)) {
          const categoryResponses = responses[category].responses;
          return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
        }
      }
    }
  }

  const defaultResponses = responses.default.responses;
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

// Process message
const processMessage = (message) => {
  message = message.replace(/\s+/g, ' ').trim();
  const questionWords = ['what', 'when', 'where', 'who', 'how', 'why'];
  const isQuestion = questionWords.some(word => message.toLowerCase().startsWith(word));
  
  return {
    processed: message,
    isQuestion,
    timestamp: new Date().toISOString()
  };
};

// API Routes
app.post('/api/conversations', (req, res) => {
  const id = Date.now().toString();
  db.run('INSERT INTO conversations (id) VALUES (?)', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ conversationId: id });
    }
  });
});

app.post('/api/chat', (req, res) => {
  const { message, conversationId } = req.body;
  const processedMessage = processMessage(message);
  
  // Store user message
  db.run(
    'INSERT INTO messages (content, sender, conversation_id, is_question) VALUES (?, ?, ?, ?)',
    [message, 'user', conversationId, processedMessage.isQuestion ? 1 : 0],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Generate and store bot response
      const botResponse = generateBotResponse(processedMessage.processed);
      db.run(
        'INSERT INTO messages (content, sender, conversation_id, is_question) VALUES (?, ?, ?, ?)',
        [botResponse, 'bot', conversationId, 0],
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          // Update conversation last activity
          db.run(
            'UPDATE conversations SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
            [conversationId],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              res.json({ 
                response: botResponse,
                processed: processedMessage
              });
            }
          );
        }
      );
    }
  );
});

app.get('/api/conversations/:id/messages', (req, res) => {
  db.all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});