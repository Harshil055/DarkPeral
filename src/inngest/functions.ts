import { inngest } from "./client";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";
import Sandbox from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";

interface AgentState {
  summary: string;
  files: { [path: string]: string };

}
export const codeAgentFunction = inngest.createFunction(
  { id: "lovable-clone" },
  { event: "lovable-clone/run" },
  async ({ event, step }) => {

    const sandboxId = await step.run("get-sandbox-id", async ()=>{
      // Using rebuilt template with App Router only fixes
      const sandbox = await Sandbox.create("sarkfickz793gssodcmg")
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    })

    const previousMessages = await step.run("get-previous-messages", async ()=>{
      const formattedMessages: Message[] = [];
      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5

      })

      for(const message of messages){
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        })
      }
      return formattedMessages.reverse();
    })

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      }
    )

     // Create a new agent with a system prompt (you can add optional tools, too)
     const codeAgent = createAgent<AgentState>({
      name: "lovable-clone",
      description: "An expert coding agent.",
      system: PROMPT,
      model: openai({ model: "gpt-4.1",
        defaultParameters: {
          temperature: 0.1,
        }
       }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }: { command: string }, { step }: Tool.Options<AgentState>) => {
            return await step?.run("terminal", async ()=>{
              const buffers = { stdout: "", stderr: "" };
              try{
                const sandbox = await getSandbox(sandboxId)
                const result = await sandbox.commands.run(command,{
                  onStdout: (data: string) => {
                    buffers.stdout += data
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data
                  }
                })
                return result.stdout;
              }catch(e){
                console.error(
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
                )
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
              }
            })
          }
        }),

        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files }: { files: { path: string; content: string }[] },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run("createOrUpdateFiles", async ()=>{
              try{
                const updatedFiles = await network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId)

                // CRITICAL VALIDATION: Prevent Pages Router file creation
                for(const file of files){
                  // Block any files starting with "pages/" to prevent routing conflicts
                  if(file.path.startsWith("pages/") || file.path.startsWith("/pages/")){
                    throw new Error(
                      `ROUTING CONFLICT: Cannot create "${file.path}". This project uses App Router only. ` +
                      `Use "app/" directory instead (e.g., "app/page.tsx" instead of "pages/index.tsx"). ` +
                      `Creating files in pages/ will cause: "App router and Pages router both match path" error.`
                    );
                  }

                  await sandbox.files.write(file.path, file.content)
                  updatedFiles[file.path] = file.content;
                }
                return updatedFiles;
              } catch(e){
                return `Error: ${e}`
              }
            })

            if(typeof newFiles === "object"){
              return network.state.data.files = newFiles;
            }
          }
        }),

        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }: { files: string[] }, { step }: Tool.Options<AgentState>) => {
            return await step?.run("readFiles", async ()=>{
              try{
                const sandbox = await getSandbox(sandboxId)
                const contents = [];
                for(const file of files){
                  const content = await sandbox.files.read(file);
                  contents.push({path: file, content})
                }
                return JSON.stringify(contents);
              } catch(e){
                return `Error: ${e}`
              }
            })
          }
        })


      ],

      lifecycle: {
        onResponse: async (args) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(args.result);

          if(lastAssistantMessageText && args.network){
            if(lastAssistantMessageText.includes("<task_summary>")){
              args.network.state.data.summary = lastAssistantMessageText;
            }
          }
          return args.result;
        }
      },


    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }: { network: any }) => {
        const summary = network.state.data.summary;
        if(summary){
          return ; // if we detect summary, then stop the network
        }
        return codeAgent;
      }
    })
    
    const result = await network.run(event.data.value, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator.",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ model: "gpt-4o-mini"}),
    })
    
    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator.",
      system: RESPONSE_PROMPT,
      model: openai({ model: "gpt-4o-mini"}),
    })

    const hasSummary = !!result.state.data.summary;
    const fragmentTitleOutput = hasSummary ? (await fragmentTitleGenerator.run(result.state.data.summary)).output : null;
    const responseOutput = hasSummary ? (await responseGenerator.run(result.state.data.summary)).output : null;

    const generateFragmentTitle = ()=>{
      if(!fragmentTitleOutput || fragmentTitleOutput[0].type !== "text"){
        return "Generated Code";
      }

      if(Array.isArray(fragmentTitleOutput[0].content)){
        return fragmentTitleOutput[0].content.map((text: any)=>text).join(" ");
      }
      else {
        return fragmentTitleOutput[0].content as string;
      }
    }
    const generateResponse = ()=>{
      if(!responseOutput || responseOutput[0].type !== "text"){
        return "Here's what I built for you.";
      }

      if(Array.isArray(responseOutput[0].content)){
        return responseOutput[0].content.map((text: any)=>text).join(" ");
      }
      else {
        return responseOutput[0].content as string;
      }
    }
    const hasFiles = Object.keys(result.state.data.files || {}).length > 0;
    const isError = !hasFiles;

    const sandboxUrl = await step.run("get-sandbox-url", async ()=>{
      const sandbox = await getSandbox(sandboxId)
      const host = sandbox.getHost(3000);
      return `https://${host}`
    })

    await step.run("save-result", async ()=>{
      if(isError){
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          }
        })
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: result.state.data.files,
            }
          }
        }
      })
    })
      
    return { 
      url: sandboxUrl,
      files: result.state.data.files,
      summary: result.state.data.summary,
     };
  },
);