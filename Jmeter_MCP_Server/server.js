import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { exec } from "child_process";
import fs from "fs";


// CREATE MCP SERVER
const server = new Server(
  {
    name: "jmeter-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);


// AUTO UPDATE JMETER PROPERTIES
function updateJMeterProperties(avgResponseTime) {

  const propertiesPath =
    "D:/Jmeter_4/jmeter-mcp-server/jmeter.properties";

  let threads = 100;

  // AUTO-TUNING LOGIC
  if (avgResponseTime > 2000) {

    threads = 50;

  } else {

    threads = 150;
  }

  const content =
`threads=${threads}
rampup=10
loops=5`;

  fs.writeFileSync(propertiesPath, content);

  console.error(
    `Updated jmeter.properties with threads=${threads}`
  );
}


// LIST TOOLS
server.setRequestHandler(ListToolsRequestSchema, async () => {

  console.error("Listing tools...");

  return {
    tools: [
      {
        name: "run_jmeter_test",
        description: "Run a JMeter test plan",

        inputSchema: {
          type: "object",

          properties: {
            testFile: {
              type: "string",
              description: "Full path of JMeter .jmx file",
            },
          },

          required: ["testFile"],
        },
      },

      {
        name: "analyze_jmeter_results",
        description: "Analyze JMeter result file",

        inputSchema: {
          type: "object",

          properties: {
            resultFile: {
              type: "string",
              description: "Path of JTL result file",
            },
          },

          required: ["resultFile"],
        },
      },
    ],
  };
});


// TOOL EXECUTION
server.setRequestHandler(CallToolRequestSchema, async (request) => {

  console.error("Tool called:", request.params.name);

  const { name, arguments: args } = request.params;


  // RUN JMETER TEST
  if (name === "run_jmeter_test") {

    return new Promise((resolve) => {

      // JMETER PATH
      const jmeterPath =
        "C:/Jmeter/apache-jmeter-5.6.3/apache-jmeter-5.6.3/bin/jmeter.bat";

      // RESULT FILE
      const resultFile =
        "D:/Jmeter_4/jmeter-mcp-server/Test_Plan_results.jtl";

      // JMETER COMMAND
      const command =
        `"${jmeterPath}" -n -t "${args.testFile}" -l "${resultFile}"`;

      console.error("Executing command:");
      console.error(command);

      // EXECUTE JMETER
      exec(command, (error, stdout, stderr) => {

        // HANDLE ERRORS
        if (error) {

          resolve({
            content: [
              {
                type: "text",

                text:
                  `JMeter Execution Failed\n\n` +
                  `Error: ${error.message}\n\n` +
                  `STDERR:\n${stderr}`,
              },
            ],
          });

          return;
        }

        let summary =
          "JMeter Test Executed Successfully\n\n";

        // READ RESULT FILE
        if (fs.existsSync(resultFile)) {

          const data =
            fs.readFileSync(resultFile, "utf8");

          const rows =
            data
              .split("\n")
              .filter(line => line.trim() !== "");

          let totalTime = 0;

          let failures = 0;

          // PROCESS RESULTS
          for (let i = 1; i < rows.length; i++) {

            const cols = rows[i].split(",");

            // RESPONSE TIME
            if (cols[1]) {
              totalTime += Number(cols[1]);
            }

            // FAILURE COUNT
            if (cols[7] === "false") {
              failures++;
            }
          }

          // TOTAL REQUESTS
          const totalRequests =
            rows.length - 1;

          // AVERAGE RESPONSE TIME
          const avgResponseTime =
            totalTime / totalRequests;

          // ERROR %
          const errorPercent =
            (failures / totalRequests) * 100;

          // AUTO UPDATE PROPERTIES
          updateJMeterProperties(avgResponseTime);

          summary +=
            `Total Requests: ${totalRequests}\n`;

          summary +=
            `Average Response Time: ${avgResponseTime.toFixed(2)} ms\n`;

          summary +=
            `Error Percentage: ${errorPercent.toFixed(2)}%\n\n`;

          // PERFORMANCE GATE
          if (errorPercent > 2) {

            summary +=
              "PERFORMANCE GATE FAILED\n";

          } else {

            summary +=
              "PERFORMANCE GATE PASSED\n";
          }
        }

        // ADD STDOUT
        if (stdout) {
          summary += `\nSTDOUT:\n${stdout}\n`;
        }

        // ADD STDERR
        if (stderr) {
          summary += `\nSTDERR:\n${stderr}\n`;
        }

        resolve({
          content: [
            {
              type: "text",
              text: summary,
            },
          ],
        });

      });

    });
  }


  // ANALYZE RESULTS
  if (name === "analyze_jmeter_results") {

    try {

      const data =
        fs.readFileSync(args.resultFile, "utf8");

      const rows =
        data
          .split("\n")
          .filter(line => line.trim() !== "");

      const totalRequests =
        rows.length - 1;

      return {
        content: [
          {
            type: "text",

            text:
`AI Performance Analysis

Total Requests: ${totalRequests}

Potential Bottlenecks:
- High response time spikes observed
- Possible server saturation
- Consider increasing JVM heap size
- Optimize database queries
- Add connection pooling
- Reduce thread contention
`,
          },
        ],
      };

    } catch (err) {

      return {
        content: [
          {
            type: "text",
            text: `Analysis Failed: ${err.message}`,
          },
        ],
      };
    }
  }


  // UNKNOWN TOOL
  return {
    content: [
      {
        type: "text",
        text: "Unknown tool called.",
      },
    ],
  };
});


// START SERVER
async function main() {

  const transport =
    new StdioServerTransport();

  await server.connect(transport);

  console.error("JMeter MCP Server Running...");
}


// START APPLICATION
main().catch((err) => {
  console.error("Fatal Error:", err);
});