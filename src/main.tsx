import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { logCreatorSignature } from "./lib/creatorSignature";

/* Signature de créateur (CLEEF OLIGENS JOSEPH) — console uniquement.
   Effet de bord d'initialisation : aucune injection dans le DOM visible. */
logCreatorSignature();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

/* Service Worker (PWA) — production uniquement, pour éviter le cache en dev. */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW indisponible : l'app reste pleinement fonctionnelle en ligne */
    });
  });
}
