const targetURL = "https://thisdomaindoesnotexist12345.com";

const checkHost = async (url) => {
  const startTime = Date.now();
  try {
    const response = await fetch(url);
    const latency = Date.now() - startTime;
    console.log(`[UP] ${url} | STATUS ${response.status} | Latency ${latency}ms.`);
  } catch (error) {
    const latency = Date.now() - startTime;
    console.log(`[DOWN] ${url} | Error: ${error.message} | Latency ${latency}ms.`);
  }
};


checkHost(targetURL);