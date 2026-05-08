const OpenAI = require("openai");
const OPENAI_API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const OPENAI_MODEL = "gpt-3.5-turbo"; "gpt-4"
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

module.exports = async (req, res) => {
    // Activer CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Vérification de la méthode
    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Méthode non autorisée. Utilisez POST." 
        });
    }

    // Vérification de la clé API
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
        return res.status(500).json({ 
            success: false, 
            error: "Clé API OpenAI non configurée" 
        });
    }

    const { message, history = [], systemPrompt } = req.body;

    // Validation du message
    if (!message || typeof message !== "string") {
        return res.status(400).json({ 
            success: false, 
            error: "Message requis (string)" 
        });
    }

    if (message.length > 4000) {
        return res.status(400).json({ 
            success: false, 
            error: "Message trop long (max 4000 caractères)" 
        });
    }

    try {
        // Construction des messages
        const messages = [
            {
                role: "system",
                content: systemPrompt || "Tu es un assistant utile, amical et concis. Tu réponds en français sauf si l'utilisateur utilise une autre langue."
            },
            ...history.slice(-10).map(msg => ({
                role: msg.role === "user" ? "user" : "assistant",
                content: String(msg.content).substring(0, 3000)
            })),
            {
                role: "user",
                content: message
            }
        ];

        
        const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 0.95,
            frequency_penalty: 0.5,
            presence_penalty: 0.5
        });

        const reply = completion.choices[0].message.content;
        const usage = completion.usage;

        // Calcul du coût estimé
        const costPer1kTokens = OPENAI_MODEL === "gpt-4" ? 0.03 : 0.002;
        const estimatedCost = (usage.total_tokens / 1000) * costPer1kTokens;

        return res.status(200).json({
            success: true,
            reply: reply,
            usage: {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                estimatedCost: estimatedCost.toFixed(6)
            }
        });

    } catch (error) {
        console.error("OpenAI Error:", error);
        
        if (error.status === 401) {
            return res.status(401).json({ success: false, error: "Clé API invalide" });
        } else if (error.status === 429) {
            return res.status(429).json({ success: false, error: "Limite de requêtes dépassée" });
        } else if (error.status === 500) {
            return res.status(500).json({ success: false, error: "Erreur serveur OpenAI" });
        } else {
            return res.status(500).json({ success: false, error: error.message || "Erreur lors de la génération" });
        }
    }
}
