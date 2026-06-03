require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generateQuestionPaper = async (
  title,
  questionTypes,
  additionalInfo,
  pdfContent
) => {
  const questionTypesDescription = Array.isArray(questionTypes)
    ? questionTypes
        .map((qt) => {
          if (typeof qt === "object" && qt !== null) {
            return `- ${qt.type}: ${qt.count || 5} question(s), ${qt.marks || 1} mark(s) each`;
          }
          return `- ${qt}`;
        })
        .join("\n")
    : questionTypes;

  // Build source material section based on whether PDF was uploaded
  let sourceSection = "";
  if (pdfContent && pdfContent.trim().length > 0) {
    // Truncate to 6000 chars to stay within token limits
    const truncated = pdfContent.slice(0, 6000);
    sourceSection = `
**SOURCE MATERIAL (from uploaded PDF):**
${truncated}

CRITICAL INSTRUCTION: Generate ALL questions ONLY from the source material above. Do NOT use general knowledge. Every question must be directly answerable from the provided text.
`;
  } else {
    sourceSection = `
**Additional Information / Topics:**
${additionalInfo || "None"}
`;
  }

  const prompt = `
You are an expert school teacher and question paper designer.

Create a detailed, structured question paper based on the following specifications.

**Assignment Title:** ${title}

**Question Types and Distribution:**
${questionTypesDescription}

${sourceSection}

You MUST respond with ONLY valid JSON (no markdown, no code fences, no explanation). Use this EXACT format:

{
  "title": "${title}",
  "totalMarks": <number - sum of all marks>,
  "duration": "<estimated time, e.g. 45 minutes>",
  "sections": [
    {
      "title": "Section A - <Question Type>",
      "instruction": "<brief instruction for this section>",
      "questions": [
        {
          "number": 1,
          "question": "<question text>",
          "options": ["a) ...", "b) ...", "c) ...", "d) ..."],
          "difficulty": "Easy",
          "marks": 1
        }
      ]
    }
  ],
  "answerKey": [
    {
      "number": 1,
      "answer": "<correct answer>"
    }
  ]
}

Rules:
- For MCQ questions, always include exactly 4 options.
- For non-MCQ questions (Short Answer, Long Answer, True/False, Fill in the Blanks), omit the "options" field.
- Number all questions sequentially across sections.
- Include an answer for every question in the answerKey.
- Ensure totalMarks equals the sum of marks of all questions.
- MATHEMATICS/LATEX (CRITICAL): You MUST format ALL mathematical symbols, equations, and fractions using valid MathJax LaTeX. 
- ALWAYS enclose inline math in $...$ and block math in $$...$$. 
- ALWAYS use backslashes for commands (e.g., use \\int instead of int, use \\frac instead of frac).
- CRITICAL JSON ESCAPING: You MUST double-escape all backslashes in JSON (e.g., use \\\\frac{}{} instead of \\frac{}{}, use \\\\int instead of \\int).
- Ensure perfectly balanced braces {} and brackets [].
- Return ONLY the JSON object, nothing else.
\`;

  console.log("Sending prompt to Groq");
  console.log("Prompt length:", prompt.length);
  console.log("Has PDF content:", !!(pdfContent && pdfContent.trim().length > 0));

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const rawText = chatCompletion.choices[0].message.content;

  let cleaned = rawText.trim();
  if (cleaned.startsWith("\`\`\`")) {
    cleaned = cleaned.replace(/^\`\`\`(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?\s*\`\`\`\s*$/, "");
    cleaned = cleaned.trim();
  }
  
  // FLAWLESS JSON SANITIZATION:
  // Automatically fix any single backslashes (like \frac or \int) that the AI forgot to double escape.
  // We strictly ignore valid JSON escapes like \n, \r, \t, \", \\, and \/ to prevent JSON corruption.
  cleaned = cleaned.replace(/(?<!\\\\)\\\\(?!["\\\\/nrt])/g, "\\\\\\\\");

  // Recursive sanitization for mathematical robustness (Fix missing $ terminators)
  const sanitizeGeneratedPaper = (obj) => {
    if (typeof obj === 'string') {
        let text = obj;
        const dollarCount = (text.match(/\\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
            text += '$';
        }
        return text;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeGeneratedPaper);
    }
    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (let key in obj) {
            newObj[key] = sanitizeGeneratedPaper(obj[key]);
        }
        return newObj;
    }
    return obj;
  };

  // Deep Diagnostic Logging for MathJax inspection
  console.log("\n================ [DEBUG: GROQ RESPONSE] ================\n");
  console.log("1. RAW GROQ TEXT:\n", rawText);
  console.log("\n2. CLEANED STRING (Before Parse):\n", cleaned);

  try {
    const parsedData = JSON.parse(cleaned);
    console.log("\n3. PARSED JSON OBJECT:\n", JSON.stringify(parsedData, null, 2));
    console.log("\n==========================================================\n");
    return sanitizeGeneratedPaper(parsedData);
  } catch (parseError) {
    console.error("Failed to parse Groq response:", parseError.message);
    console.error("Raw response:", rawText);

    return {
      title: title || "Question Paper",
      totalMarks: 0,
      duration: "30 minutes",
      sections: [
        {
          title: "Section A",
          instruction: "Answer the following questions.",
          questions: [
            {
              number: 1,
              question: "AI generation failed. Please regenerate this paper.",
              difficulty: "N/A",
              marks: 0,
            },
          ],
        },
      ],
      answerKey: [{ number: 1, answer: "N/A" }],
    };
  }
};

module.exports = {
  generateQuestionPaper,
};