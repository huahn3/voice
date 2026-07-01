
import crypto from 'crypto';
import prisma from '../src/lib/prisma';
const BASE_URL = 'http://localhost:5173';

async function main() {
    console.log("Starting Phase 5 Verification...");

    // 1. Test Rate Limiting
    const testIp = "1.2.3.4";
    console.log(`\nTesting Rate Limit for IP ${testIp}...`);
    // Clear old logs
    await prisma.verifyLog.deleteMany({ where: { ip: testIp } });

    // Insert 61 logs
    const logs = [];
    for (let i = 0; i < 61; i++) {
        logs.push({
            action: 'VERIFY',
            ip: testIp,
            success: true,
            createdAt: new Date()
        });
    }
    await prisma.verifyLog.createMany({ data: logs });

    // Request API
    const resRate = await fetch(`${BASE_URL}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
        body: JSON.stringify({ key: "any" })
    });
    const dataRate = await resRate.json();
    if (!dataRate.success && dataRate.message.includes("频繁")) {
        console.log("✅ Rate Limit: PASSED");
    } else {
        console.error("❌ Rate Limit: FAILED", dataRate);
    }

    // 2. Test Encryption & Force Update setup
    const slug = "test-enc-product-" + Date.now();
    const encKey = "12345678123456781234567812345678"; // 32 chars
    const script = "console.log('Hello World');";

    const product = await prisma.product.create({
        data: {
            name: "Test Product",
            slug,
            deliveryType: "SCRIPT_DISPLAY",
            encryptionKey: encKey,
            isActive: true,
            versions: {
                create: {
                    version: "1.0.0",
                    scriptContent: script,
                    isActive: true,
                    channel: "STABLE"
                }
            }
        },
        include: { versions: true }
    });

    const card = await prisma.cardKey.create({
        data: {
            productId: product.id,
            key: "TEST-KEY-" + Date.now(),
            type: "TIME",
            status: "ACTIVE"
        }
    });

    // 3. Verify Encryption
    console.log(`\nTesting Encryption...`);
    const resEnc = await fetch(`${BASE_URL}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: card.key, version: "1.0.0" })
    });
    const dataEnc = await resEnc.json();

    if (dataEnc.success && dataEnc.data.valid) {
        const encryptedContent = dataEnc.data.delivery.data;
        if (encryptedContent !== script) {
            console.log("✅ Content is encrypted");

            // Try Decrypt
            try {
                const buffer = Buffer.from(encryptedContent, 'base64');
                const iv = buffer.subarray(0, 16);
                const encrypted = buffer.subarray(16);

                // Use SHA256 of key as per implementation
                const keyHash = crypto.createHash('sha256').update(encKey).digest();

                const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
                let decrypted = decipher.update(encrypted);
                decrypted = Buffer.concat([decrypted, decipher.final()]);

                if (decrypted.toString() === script) {
                    console.log("✅ Decryption successful: PASSED");
                } else {
                    console.error("❌ Decryption result mismatch:", decrypted.toString());
                }
            } catch (e) {
                console.error("❌ Decryption failed", e);
            }
        } else {
            console.error("❌ Content matches plaintext (NOT ENCRYPTED)");
        }
    } else {
        console.error("❌ Verify failed for valid card", dataEnc);
    }

    // 4. Test Fore Update
    console.log(`\nTesting Force Update...`);
    // Create new version with forceUpdate
    await prisma.productVersion.create({
        data: {
            productId: product.id,
            version: "2.0.0",
            forceUpdate: true,
            channel: "STABLE"
        }
    });

    const resForce = await fetch(`${BASE_URL}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: card.key, version: "1.0.0" }) // Sending Old Version
    });
    const dataForce = await resForce.json();

    if (dataForce.success && dataForce.data.product.forceUpdate === true) {
        // My impl returns success=true (200 OK) but inner valid=false (wait, I returned valid=false in data?)
        // Let's check impl: 
        // return createResponse(true, "版本过低...", updateData) -> success=true, data=updateData
        // updateData = { valid: false, product: { ... forceUpdate: true } }

        if (dataForce.data.valid === false && dataForce.data.product.latestVersion === "2.0.0") {
            console.log("✅ Force Update Refusal: PASSED");
        } else {
            console.error("❌ Force Update logic check failed", dataForce);
        }
    } else {
        console.error("❌ API Response failed for force update check", dataForce);
    }

    // clean up
    await prisma.verifyLog.deleteMany({ where: { ip: testIp } });
    await prisma.cardKey.delete({ where: { id: card.id } });
    await prisma.product.delete({ where: { id: product.id } });
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
