import { cmd } from "../../cli/cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../../cli/ui"
import { Auth } from "../../auth"

export const MgrepLoginCommand = cmd({
  command: "login",
  describe: "authenticate with mgrep service",
  async handler() {
    UI.empty()
    prompts.intro("Login to mgrep")

    const apiKey = await prompts.password({
      message: "Enter your mgrep API key",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(apiKey)) throw new UI.CancelledError()

    await Auth.set("mgrep", {
      type: "api",
      key: apiKey,
    })

    prompts.log.success("Logged into mgrep")
    prompts.outro("Done")
  },
})
