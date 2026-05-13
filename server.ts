import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ================= API ROUTES (CRM) =================
  let users = [
    { id: 1, name: "Edgar", role: "Admin" },
    { id: 2, name: "Supervisor 1", role: "Supervisor" },
  ];

  let leads: any[] = [
    { id: 101, name: "Juan Pérez", phone: "5512345678", status: "nuevo" },
    { id: 102, name: "María García", phone: "5598765432", status: "seguimiento" },
  ];

  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.get("/api/leads", (req, res) => {
    res.json(leads);
  });

  app.post("/api/leads", (req, res) => {
    const newLead = { id: Date.now(), ...req.body };
    leads.push(newLead);
    res.json(newLead);
  });

  app.post("/api/leads/:id", (req, res) => {
    leads = leads.map((l) =>
      l.id == parseInt(req.params.id) ? { ...l, ...req.body } : l
    );
    res.json({ ok: true });
  });

  // ================= VITE MIDDLEWARE =================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
