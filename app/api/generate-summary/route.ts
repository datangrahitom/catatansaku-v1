import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { expenses, allocations, budget, month } = body;

    const totalSpent = expenses.reduce((acc: number, e: any) => acc + e.amount, 0);
    const categoryBreakdown = expenses.reduce((acc: any, e: any) => {
      const cat = e.category || 'Lainnya';
      acc[cat] = (acc[cat] || 0) + e.amount;
      return acc;
    }, {});
    
    // Calculate total allocations
    const totalAllocations = (allocations || []).reduce((acc: number, a: any) => acc + a.amount, 0);
    const allocationsDetails = (allocations || []).map((a: any) => `${a.name}: Rp ${a.amount}`).join(', ');

    const prompt = `
Generate a concise financial report summary for ${month}. 
Total Budget: Rp ${budget}
Total Allocated/Saved: Rp ${totalAllocations} (${allocationsDetails || 'None'})
Total Spent: Rp ${totalSpent}
Category Breakdown: ${JSON.stringify(categoryBreakdown)}

Provide:
1. A short analysis of spending trends vs how well they are allocating their funds.
2. Comments on budget adherence.
3. 2-3 specific suggestions for savings next month or maximizing their allocations.
Keep the tone encouraging, use Bahasa Indonesia, and format clearly using Markdown or plain text. Do not output JSON. Respond with raw text/markdown.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const report = response.text;

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("AI Generation Error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
