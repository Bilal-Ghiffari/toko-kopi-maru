import { NextResponse } from "next/server";
import { llm, getProviderInfo } from "@/lib/ai/langchain";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const dynamic = "force-dynamic";

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
  } catch (error: unknown) {
    console.error("AI Test Error:", error);

    // Get provider info untuk error reporting
    const providerInfo = getProviderInfo();
    const errMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        status: "error",
        message: errMsg,
        provider: providerInfo,
        hint:
          providerInfo.provider === "grok"
            ? "Pastikan OPENROUTER_API_KEY sudah di-set di .env.local. Dapatkan di: https://openrouter.ai/settings/keys"
            : "Pastikan OPENAI_API_KEY sudah di-set di .env.local",
      },
      { status: 500 },
    );
  }
}
