import app from "./server.js";


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`BookNook Server running at http://localhost:${PORT}`);
});

export default app;