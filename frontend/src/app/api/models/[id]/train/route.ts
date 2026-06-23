import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const {
    dataset_path,
    base_model_key,
    numEpochs,
    learningRate,
    batchSize,
    warmupSteps,
    maxSeqLength,
  } = await req.json();

  try {
    const result = await backendFetchJson(
      `/models/${id}/train`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_path,
          base_model_key: base_model_key ?? "llama3.2-1b",
          num_epochs:     numEpochs     ?? 3,
          learning_rate:  learningRate  ?? 2e-4,
          batch_size:     batchSize     ?? 1,
          warmup_steps:   warmupSteps   ?? 10,
          max_seq_length: maxSeqLength  ?? 512,
        }),
        token,
      }
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to start training" }, { status: 500 });
  }
}