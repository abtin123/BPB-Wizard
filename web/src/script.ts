import { toFile, Uploadable } from "cloudflare";
import { CFAccount } from "./api";
import { randCode, randString } from "./random";

interface Script {
    script: Uploadable;
    path: string;
}

export async function buildScript(
    account: CFAccount,
    workerName: string,
    subdomain: string,
    filename: string,
    preRelease: boolean
): Promise<Script> {
    const pathCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456780-_';
    const passCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$&*_-+;:,.';

    const sources = [
        'https://github.com/abtin123/BPB-Worker-Panel/releases/latest/download/worker.js',
        'https://github.com/abtin123/BPB-Wizard/releases/latest/download/worker.js'
    ];

    let script = '';
    const errors: string[] = [];
    for (const url of sources) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                errors.push(`status ${res.status} at ${url}`);
                continue;
            }

            const text = await res.text();
            if (text.length > 1000) {
                script = text;
                break;
            }

            errors.push(`empty response at ${url}`);
        } catch (error) {
            errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (!script) {
        throw new Error(`Failed to get panel script (run "Build and Release" in the panel repo first): ${errors.join('; ')}`);
    }

    const buildTimestamp = new Date().toISOString();
    const randomCode = randCode();
    const path = randString(pathCharset, 12, 16);

    const embededSettings = {
        accID: account.id,
        accEmail: account.email,
        apiToken: account.token,
        vlUUID: crypto.randomUUID(),
        trPass: randString(passCharset, 16, 20),
        securePath: path,
        proxyIpMode: 'proxyip',
        proxyIPs: [],
        prefixes: [],
        fallback: '',
        dohUrl: '',
        mainDomain: `${workerName}.${subdomain}`
    };

    const worker = [
        `// ${account.email}`,
        `// Build: ${buildTimestamp}`,
        '// @ts-nocheck',
        `${randomCode}const EMBEDED_SETTINGS = ${JSON.stringify(embededSettings)};${script}`
    ].join('\n');

    const file = new TextEncoder().encode(worker);
    const uploadable: Uploadable = await toFile(file, filename, {
        type: 'application/javascript+module',
    });

    return {
        script: uploadable,
        path: path
    }
}
