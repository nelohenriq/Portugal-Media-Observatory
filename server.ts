import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin (Server-side)
const firebaseConfig = {
  projectId: "elemental-kite-493120-h7",
  databaseId: "ai-studio-76a78ab7-64f6-4917-a882-5a60baf1fd27"
};

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const db = admin.firestore(firebaseConfig.databaseId);

// Initialize Gemini API
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes (pt-media-api.md) ---

  // POST /api/investigations - Create a new investigation
  app.post("/api/investigations", async (req, res) => {
    try {
      const { url, raw_text, source_type, source_handle, source_display_name, topic_hints, notes } = req.body;

      if (!source_type) {
        return res.status(400).json({ error: { code: "MISSING_SOURCE_TYPE", message: "Source type is required" } });
      }

      // 1. Create/Update IndependentSource
      let sourceId = null;
      if (source_handle || source_display_name) {
        const sourceRef = db.collection("independentSources").doc(`${source_type}_${source_handle || source_display_name}`);
        await sourceRef.set({
          display_name: source_display_name || source_handle,
          handle: source_handle,
          platform: source_type,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        sourceId = sourceRef.id;
      }

      // 2. Create SubmittedItem
      const submittedItemRef = db.collection("submittedItems").doc();
      await submittedItemRef.set({
        independentSourceId: sourceId,
        submitted_by: "herminio",
        url,
        raw_text,
        source_type,
        topic_hints: topic_hints || [],
        notes,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Create Event (Intake)
      const eventRef = db.collection("events").doc();
      await eventRef.set({
        title: "Pending curation",
        status: "intake",
        primarySubmittedItemId: submittedItemRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Create Stage Run (Curation)
      const stageRunRef = eventRef.collection("stageRuns").doc();
      await stageRunRef.set({
        eventId: eventRef.id,
        stage: "curation",
        status: "pending",
        attemptCount: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Simulation of Orchestration: In a real "Hermes" setup, this would trigger a task.
      // Here, the backend will act as the orchestrator.
      triggerOrchestration(eventRef.id);

      res.status(201).json({
        investigation_id: eventRef.id,
        submitted_item_id: submittedItemRef.id,
        status: "intake"
      });
    } catch (error: any) {
      console.error("Error creating investigation:", error);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error.message } });
    }
  });

  // GET /api/investigations/:id - Get full investigation details
  app.get("/api/investigations/:id", async (req, res) => {
    try {
      const eventId = req.params.id;
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
        return res.status(404).json({ error: { code: "INVESTIGATION_NOT_FOUND", message: "Investigation not found" } });
      }

      const eventData = eventDoc.data();
      const submissionDoc = await db.collection("submittedItems").doc(eventData?.primarySubmittedItemId).get();
      const stageRuns = await db.collection("events").doc(eventId).collection("stageRuns").orderBy("createdAt", "desc").get();

      // Composition of full object
      const fullObject = {
        id: eventId,
        ...eventData,
        submission: submissionDoc.data(),
        stages: stageRuns.docs.map(doc => doc.data())
      };

      res.json(fullObject);
    } catch (error: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error.message } });
    }
  });

  // GET /api/investigations - List investigations
  app.get("/api/investigations", async (req, res) => {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      let query: any = db.collection("events");
      if (status) query = query.where("status", "==", status);
      query = query.orderBy("createdAt", "desc").limit(Number(limit)).offset(Number(offset));
      
      const snapshot = await query.get();
      const items = await Promise.all(snapshot.docs.map(async (doc: any)  => {
        const eventData = doc.data();
        const stagesSnapshot = await doc.ref.collection("stageRuns").orderBy("createdAt", "asc").get();
        const stages = stagesSnapshot.docs.map((s: any) => s.data());
        return { id: doc.id, ...eventData, stages };
      }));
      
      res.json({ items, total: snapshot.size });
    } catch (error: any) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error.message } });
    }
  });

  // --- Orchestration Logic ---

  async function triggerOrchestration(eventId: string) {
    console.log(`[Orchestrator] Triggered for event ${eventId}`);
    runCuration(eventId);
  }

  async function runCuration(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const stageRuns = await eventRef.collection("stageRuns").where("stage", "==", "curation").where("status", "==", "pending").limit(1).get();
    if (stageRuns.empty) return;

    const runDoc = stageRuns.docs[0];
    await runDoc.ref.update({ status: "running", startedAt: admin.firestore.FieldValue.serverTimestamp() });

    try {
      const eventDoc = await eventRef.get();
      const submissionDoc = await db.collection("submittedItems").doc(eventDoc.data()?.primarySubmittedItemId).get();
      const submission = submissionDoc.data();

      const prompt = `
        You are a media curator. Normalize this submission:
        URL: ${submission?.url || "N/A"}
        Notes: ${submission?.notes || "N/A"}
        Respond ONLY with a JSON object: { title, summary_pt, claim_core, entities: [], date_hint, topics: [] }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      const text = result.text?.replace(/```json|```/g, "").trim() || "{}";
      const output = JSON.parse(text);

      await eventRef.update({
        ...output,
        status: "researching",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await runDoc.ref.update({ status: "succeeded", outputSnapshot: output, finishedAt: admin.firestore.FieldValue.serverTimestamp() });

      await createStage(eventId, "research");
      await createStage(eventId, "coverage");
      
      setTimeout(() => runResearch(eventId), 2000);
      setTimeout(() => runCoverage(eventId), 3000);
    } catch (error: any) {
      console.error("Curation error:", error);
      await runDoc.ref.update({ status: "failed", errorMessage: error.message });
    }
  }

  async function runResearch(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const stageRuns = await eventRef.collection("stageRuns").where("stage", "==", "research").where("status", "==", "pending").limit(1).get();
    if (stageRuns.empty) return;
    
    const runDoc = stageRuns.docs[0];
    await runDoc.ref.update({ status: "running", startedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    try {
      const eventData = (await eventRef.get()).data();
      const prompt = `
        You are a researcher. Research this event: ${eventData?.title} / ${eventData?.claim_core}.
        Provide a factual evidence report in JSON: { facts: [], independent_claims: [], primary_documents: [{url, type, note}], uncertainties: [] }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      const output = JSON.parse(result.text?.replace(/```json|```/g, "").trim() || "{}");

      await db.collection("events").doc(eventId).collection("research").doc("report").set({
        ...output,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await runDoc.ref.update({ status: "succeeded", outputSnapshot: output, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      checkAdvanceToRisk(eventId);
    } catch (error: any) {
      await runDoc.ref.update({ status: "failed", errorMessage: error.message });
    }
  }

  async function runCoverage(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const stageRuns = await eventRef.collection("stageRuns").where("stage", "==", "coverage").where("status", "==", "pending").limit(1).get();
    if (stageRuns.empty) return;
    
    const runDoc = stageRuns.docs[0];
    await runDoc.ref.update({ status: "running", startedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    try {
      const eventData = (await eventRef.get()).data();
      const prompt = `
        You are a coverage analyzer. Find mainstream coverage (simulated) for: ${eventData?.title}.
        Respond in JSON: { matched_articles: [{outlet, url, framing, depth}], metrics: { outlets_count, coverage_level: 'none'|'minimal'|'broad' } }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      const output = JSON.parse(result.text?.replace(/```json|```/g, "").trim() || "{}");

      await db.collection("events").doc(eventId).collection("coverage").doc("report").set({
        ...output,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await runDoc.ref.update({ status: "succeeded", outputSnapshot: output, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      checkAdvanceToRisk(eventId);
    } catch (error: any) {
      await runDoc.ref.update({ status: "failed", errorMessage: error.message });
    }
  }

  async function checkAdvanceToRisk(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const succeededStages = await eventRef.collection("stageRuns").where("status", "==", "succeeded").get();
    const stages = succeededStages.docs.map(d => d.data().stage);
    
    if (stages.includes("research") && stages.includes("coverage")) {
      const riskExists = (await eventRef.collection("stageRuns").where("stage", "==", "risk").get()).size > 0;
      if (!riskExists) {
        await createStage(eventId, "risk");
        setTimeout(() => runRisk(eventId), 2000);
      }
    }
  }

  async function runRisk(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const stageRuns = await eventRef.collection("stageRuns").where("stage", "==", "risk").where("status", "==", "pending").limit(1).get();
    if (stageRuns.empty) return;
    
    const runDoc = stageRuns.docs[0];
    await runDoc.ref.update({ status: "running", startedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    try {
      const researchDoc = await eventRef.collection("research").doc("report").get();
      const coverageDoc = await eventRef.collection("coverage").doc("report").get();

      const prompt = `
        You are a risk reviewer. Analyze accuracy and undercoverage.
        Research: ${JSON.stringify(researchDoc.data())}
        Coverage: ${JSON.stringify(coverageDoc.data())}
        Respond in JSON: { reliability_score: 0-3, undercoverage_score: 0-3, risk_flags: [], notes_for_editor: "" }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      const output = JSON.parse(result.text?.replace(/```json|```/g, "").trim() || "{}");

      await eventRef.update({
        reliability_score: output.reliability_score,
        undercoverage_score: output.undercoverage_score,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await runDoc.ref.update({ status: "succeeded", outputSnapshot: output, finishedAt: admin.firestore.FieldValue.serverTimestamp() });

      // If scores pass gate, create writer stage
      if (output.reliability_score >= 1) {
        await createStage(eventId, "writer");
        setTimeout(() => runWriter(eventId), 2000);
      } else {
        await eventRef.update({ status: "needs_editor_decision" });
      }
    } catch (error: any) {
      await runDoc.ref.update({ status: "failed", errorMessage: error.message });
    }
  }

  async function runWriter(eventId: string) {
    const eventRef = db.collection("events").doc(eventId);
    const stageRuns = await eventRef.collection("stageRuns").where("stage", "==", "writer").where("status", "==", "pending").limit(1).get();
    if (stageRuns.empty) return;
    
    const runDoc = stageRuns.docs[0];
    await runDoc.ref.update({ status: "running", startedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    try {
      const eventData = (await eventRef.get()).data();
      const prompt = `
        You are the writer_pt agent for "O Que Não Cobriram".
        Event: ${eventData?.title}
        Reliability: ${eventData?.reliability_score}/3, Gap: ${eventData?.undercoverage_score}/3
        Draft in Portuguese: { thread_pt: [], card_pt: { title, body }, newsletter_pt: "" }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      const output = JSON.parse(result.text?.replace(/```json|```/g, "").trim() || "{}");

      await eventRef.collection("drafts").doc("latest").set({
        ...output,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await eventRef.update({ status: "ready_for_review" });
      await runDoc.ref.update({ status: "succeeded", outputSnapshot: output, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error: any) {
      await runDoc.ref.update({ status: "failed", errorMessage: error.message });
    }
  }

  async function createStage(eventId: string, stage: string) {
    const eventRef = db.collection("events").doc(eventId);
    await eventRef.collection("stageRuns").add({
      eventId,
      stage,
      status: "pending",
      attemptCount: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
