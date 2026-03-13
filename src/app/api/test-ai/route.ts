import { NextResponse } from "next/server";
import { llm, getProviderInfo } from "@/lib/ai/langchain";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function GET() {
  try {
    // Get provider info untuk debugging
    const providerInfo = getProviderInfo();

    // Inisialisasi StringOutputParser
    const parser = new StringOutputParser();

    // Contoh penggunaan LangChain dengan LLM dan StringOutputParser
    const response = await llm
      .pipe(parser)
      .invoke("Jawab dalam 1 kalimat: Apa fungsi utama sistem kasir?");

    // Mengembalikan respons JSON dengan hasil dari LLM
    return NextResponse.json({
      status: "ok",
      message: "LangChain is working!",
      provider: providerInfo,
      aiResponse: response, // Hasil dari LLM
    });
  } catch (error: any) {
    console.error("AI Test Error:", error);
    
    // Get provider info untuk error reporting
    const providerInfo = getProviderInfo();
    
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        provider: providerInfo,
        hint: providerInfo.provider === "grok" 
          ? "Pastikan OPENROUTER_API_KEY sudah di-set di .env.local. Dapatkan di: https://openrouter.ai/settings/keys"
          : "Pastikan OPENAI_API_KEY sudah di-set di .env.local",
      },
      { status: 500 }
    );
  }
}
