const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function analyzePdf(file, userProfile = null) {
  const bytes = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdf_base64: base64,
      filename: file.name,
      user_profile: userProfile,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to analyze statement.');
  }

  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Backend health check failed');
  }
  return response.json();
}
