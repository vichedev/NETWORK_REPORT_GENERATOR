async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

export async function analyzeImages(imgFiles, empresa) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta VITE_GROQ_API_KEY');

  const allSections = [];

  // 1. Procesamiento de cada imagen individual
  for (let f of imgFiles) {
    const b64 = await fileToBase64(f.file);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Eres un Ingeniero de Soporte Core Senior. Analiza técnicamente la gráfica de tráfico de la interfaz ${f.interfaz} en el nodo ${f.nodeName} para el cliente ${empresa}.
                
                EXTRACCIÓN DE DATOS:
                - Identifica los valores numéricos reales en la imagen: Max, Average y Last (tanto para RX como para TX).
                
                REDACTA:
                - Un análisis técnico profundo del comportamiento (picos, valles, estabilidad).
                - 3 observaciones técnicas basadas en los datos extraídos.
                - 2 recomendaciones proactivas.
                
                RESPONDE EXCLUSIVAMENTE EN FORMATO JSON:
                {
                  "desc_imagen": "Descripción técnica de la gráfica",
                  "stats": {
                    "entrada": { "max": "...", "avg": "...", "last": "..." },
                    "salida": { "max": "...", "avg": "...", "last": "..." },
                    "utilizacion": { "max": "%", "avg": "%", "last": "%" }
                  },
                  "analisis": "Texto detallado del análisis...",
                  "observaciones": ["...", "...", "..."],
                  "recomendaciones": ["...", "..."]
                }`
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${b64}` }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Error en imagen ${f.titulo}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    
    allSections.push({
      nodo: f.nodeName,
      interfaz: f.interfaz,
      titulo: f.titulo,
      periodo: f.periodo,
      ...content
    });
  }

  // 2. LLAMADA GLOBAL: Generar Resumen y Conclusiones basadas en los datos anteriores
  // Enviamos los textos extraídos para que la IA haga el cierre del informe
  const promptGlobal = `Como Ingeniero Senior, redacta el cierre de un informe para ${empresa}. 
  Se analizaron estos datos: ${JSON.stringify(allSections.map(s => ({ nodo: s.nodo, obs: s.observaciones })))}.
  
  Genera:
  1. Un Resumen Ejecutivo técnico y profesional.
  2. Tres Conclusiones Finales basadas estrictamente en las observaciones de los nodos.
  
  RESPONDE EN JSON:
  { "resumen": "...", "conclusiones": ["...", "...", "..."] }`;

  const globalResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: promptGlobal }],
      response_format: { type: "json_object" }
    })
  });

  const globalData = await globalResponse.json();
  const globalContent = JSON.parse(globalData.choices[0].message.content);

  return {
    resumen: globalContent.resumen,
    sections: allSections,
    conclusiones: globalContent.conclusiones
  };
}