const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require('multer');
const db = require("@replit/database");
const app = express();
const httpserver = http.Server(app);
const io = socketio(httpserver);
const fetch = import("node-fetch");

app.use(bodyParser.json());
const gamedirectory = path.join(__dirname);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, "./private/users/photos");
  },
    filename: (req, file, cb) => {
        const username = req.body.username;
        const customFilename = `${username}-image.jpg`;
        cb(null, customFilename);
  },
});

const upload = multer({ storage: storage });


app.use(express.json());
app.use(express.static(gamedirectory));
app.use(cors()); // Enable CORS for all routes

app.get('/', (req, res) => {
  res.sendFile('index.html');
});
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  // Read the existing users from the file
  const existingUsers = fs.readFileSync("users.txt", "utf8").split("\n");

  // Check if the username and password match any entries in the file
  if (existingUsers.includes(`${username}:${password}`)) {
    res.status(200).json({ message: "Login successful" });

    // Append the new user to the online file
  } else {
    res.status(401).json({ error: "Login failed" });
  }
});

app.post("/register", upload.single("photo"), async (req, res) => {
    const { username, password, age, info } = req.body;
  const existingUsers = fs.readFileSync("users.txt", "utf8").split("\n");
    if (!req.file || !username) {
        return res.status(400).send('No file or username provided.');
    } else if (existingUsers.includes(`${username}:${password}`)) {
      return res.status(409).json({ error: "Username already taken" });
  } else {
const userPrivateDir = `./private/users/${username}`;
    const userChatDir = `${userPrivateDir}/chats`;
    try {
      fs.mkdirSync(userPrivateDir, { recursive: true });
      fs.mkdirSync(userChatDir, { recursive: true });
      fs.writeFileSync(`${userPrivateDir}/color.txt`, '000000');
      fs.writeFileSync(`${userPrivateDir}/fav.txt`, '');

      const photoURL = `https://wrestlers-globalchat.shadowsnemesis.repl.co/private/users/photos/${req.file.filename}`;
      // Save user information to the Replit database
      fs.appendFileSync("users.txt", `${username}:${password}\n`);
      fs.writeFileSync(`./private/users/${username}/${username}.txt`, `Age: ${age}\nInfo: ${info}\nPhoto URL: ${photoURL}\n`);
      return res.status(200).json({ message: "Registration successful" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
});
app.post('/saveColor/:username', (req, res) => {
  const { username } = req.params;
  const colorValue = req.body;

  // Replace 'path/to/your/files/' with the path to your preexisting files folder
  const filePath = `/private/users/${username}/color.txt`;

  // Write the color value to the file
  fs.writeFile(`${filePath}`, `${colorValue}`);
});

 app.post('/saveInfo/:username', (req, res) => {
   const { username } = req.params;
   const info = req.body;

   // Replace 'path/to/your/files/' with the path to your preexisting files folder
   const filePath = `/private/users/${username}/${username}.txt`;

   // Write the color value to the file
   fs.writeFile(`${filePath}`, `${info}`);
 });
app.post('/uploadImage', upload.single('photo'), (req, res) => {
  res.send('File uploaded and saved!');
});


app.post('/send-message', async (req, res) => {
  try {
    const { username, avatar, text } = req.body;
    const webhook = 'https://discord.com/api/webhooks/1161657784182513716/qvdg6x-R2rWT7paRpZEvLHnM3q6y9Uou01T7CacP2EAbwFKj7lIZISoFUHshJdd2bbzA';

    const response = await fetch(webhook, {
      method: 'POST',
      data: {
        type: 1,
        username: username,
        avatar_url: avatar,
        content: text,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to send message to webhook: ${webhook}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.use('/uploads', express.static('uploads'));



var rooms = {};
var usernames = {};

io.on('connection', function(socket) {
  // Emit updated online members list on new connection
  io.emit('updateMembers', Object.values(usernames));

  socket.on("join", function(room, username) {
    if (username !== "") {
      rooms[socket.id] = room;
      usernames[socket.id] = username;
      socket.leaveAll();
      socket.join(room);
      io.in(room).emit("recieve", `Server: ${username} has entered the chat.`);
      socket.emit("join", room);

      // Update online members list after joining
      io.emit('updateMembers', Object.values(usernames));
    }
  });

  socket.on("send", function(message) {
    io.in(rooms[socket.id]).emit("recieve", `${usernames[socket.id]}: ${message}`);
  });

  socket.on("recieve", function(message) {
    socket.emit("recieve", message);
  });

  socket.on("startPrivateChat", function(targetUsername) {
    // Example: Initiating a new private chat
    const chatID = generateChatID(socket.id, targetUsername);
    socket.emit("newPrivateChat", chatID);
    const targetSocket = findUserSocketByUsername(targetUsername);
    if (targetSocket) {
      targetSocket.emit("newPrivateChat", chatID);
    }
  });

  socket.on("privateMessage", function(data) {
    // Example: Handling private messages
    const { recipient, message } = data;
    const targetSocket = findUserSocketByUsername(recipient);
    if (targetSocket) {
      targetSocket.emit("privateMessage", { sender: usernames[socket.id], message });
    }
  });

  socket.on('disconnect', function() {
    // Remove disconnected user and update online members list
    io.emit('updateMembers', Object.values(usernames));
    delete rooms[socket.id];
    delete usernames[socket.id];
  });
});

// Helper function to generate a unique chat ID
function generateChatID(user1, user2) {
  return [user1, user2].sort().join('-');
}

// Helper function to find a socket by username
function findUserSocketByUsername(username) {
  const socketIDs = Object.keys(usernames);
  for (const socketID of socketIDs) {
    if (usernames[socketID] === username && io.sockets.sockets[socketID]) {
      return io.sockets.sockets[socketID];
    }
  }
  return null;
}

httpserver.on('error', (err) => {
  console.error('Server Error:', err);
});

httpserver.listen(3000, () => {
  console.log('Server is running on port 3000');
});
