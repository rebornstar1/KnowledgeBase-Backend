const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Create Bedrock Agent Runtime client
const bedrockClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Middleware
app.use(helmet());
app.use(cors('*'));
app.use(express.json());

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query, sessionId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log('Processing query:', query);

    const params = {
      knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
          modelArn: process.env.FOUNDATION_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0', // Use inference profile ID directly
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5,
          },
        },
        generationConfiguration: {
          promptTemplate: {
            textPromptTemplate: `Use the following context to answer the question:\nContext: {{context}}\nQuestion: {{query}}\nAnswer:`,
          },
        },
      },
      input: {
        text: query,
      },
      sessionId: sessionId && typeof sessionId === 'string' ? sessionId : undefined,
    };

    console.log('Calling Bedrock Agent Runtime with params:', JSON.stringify(params, null, 2));

    const command = new RetrieveAndGenerateCommand(params);
    const response = await bedrockClient.send(command);

    console.log('Received response from Bedrock');

    console.log('Received response from Bedrock:', JSON.stringify(response, null, 2));

    res.json({
      answer: response.output.text,
      sessionId: response.sessionId,
      citations: response.citations || [],
    });
  } catch (error) {
    console.error('Error Details:', JSON.stringify(error, null, 2));
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});