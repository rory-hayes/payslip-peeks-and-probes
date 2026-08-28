import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const blockers = [];
const notes = [];

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function requireText(path, text, message) {
  if (!read(path).includes(text)) blockers.push(message);
}

function requirePattern(path, pattern, message) {
  if (!pattern.test(read(path))) blockers.push(message);
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)) ? [path] : [];
  });
}

const appConfigPath = "apps/mobile/app.json";
const infoPlistPath = "apps/mobile/ios/PayslipInsights/Info.plist";
const privacyManifestPath = "apps/mobile/ios/PayslipInsights/PrivacyInfo.xcprivacy";
const projectPath = "apps/mobile/ios/PayslipInsights.xcodeproj/project.pbxproj";
const mobilePackagePath = "apps/mobile/package.json";
const appSourcePaths = ["apps/mobile/App.tsx", ...sourceFiles("apps/mobile/src")];

let appConfig = null;
let mobilePackage = null;
try {
  appConfig = JSON.parse(read(appConfigPath));
  mobilePackage = JSON.parse(read(mobilePackagePath));
} catch {
  blockers.push("The Expo app and mobile package configuration must both be valid JSON.");
}

if (appConfig) {
  if (appConfig.expo?.version !== "1.0.0") blockers.push("Set the first App Store version to 1.0.0 in apps/mobile/app.json.");
  if (appConfig.expo?.ios?.bundleIdentifier !== "com.payslipinsights.app") blockers.push("Keep the reviewed iOS bundle identifier com.payslipinsights.app.");
  if (appConfig.expo?.ios?.buildNumber !== "1") blockers.push("Set the first App Store build number to 1 in apps/mobile/app.json.");
  if (appConfig.expo?.ios?.config?.usesNonExemptEncryption !== false) blockers.push("Declare the current build's non-exempt encryption answer explicitly.");
}

if (mobilePackage) {
  const dependencies = { ...mobilePackage.dependencies, ...mobilePackage.devDependencies };
  const nativeCommerceDependencies = ["react-native-purchases", "react-native-purchases-ui", "react-native-iap"];
  const installedCommerce = nativeCommerceDependencies.filter((dependency) => dependencies[dependency]);
  if (installedCommerce.length > 0) {
    blockers.push(`The free-companion release cannot silently include unfinished native commerce: ${installedCommerce.join(", ")}.`);
  }
}

const requiredPrivacyDataTypes = [
  "NSPrivacyCollectedDataTypeName",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypePurchaseHistory",
  "NSPrivacyCollectedDataTypeOtherFinancialInfo",
  "NSPrivacyCollectedDataTypeOtherUserContent",
];

if (appConfig) {
  const privacyManifests = appConfig.expo?.ios?.privacyManifests;
  const configuredTypes = Array.isArray(privacyManifests?.NSPrivacyCollectedDataTypes)
    ? privacyManifests.NSPrivacyCollectedDataTypes
    : [];
  if (privacyManifests?.NSPrivacyTracking !== false) blockers.push("Keep tracking disabled in the Expo privacy manifest configuration.");
  for (const dataType of requiredPrivacyDataTypes) {
    const declaration = configuredTypes.find((entry) => entry?.NSPrivacyCollectedDataType === dataType);
    if (!declaration
      || declaration.NSPrivacyCollectedDataTypeLinked !== true
      || declaration.NSPrivacyCollectedDataTypeTracking !== false
      || !declaration.NSPrivacyCollectedDataTypePurposes?.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality")) {
      blockers.push(`Declare ${dataType} as linked, non-tracking app-functionality data in apps/mobile/app.json.`);
    }
  }
  const configuredAccessedApis = Array.isArray(privacyManifests?.NSPrivacyAccessedAPITypes)
    ? privacyManifests.NSPrivacyAccessedAPITypes
    : [];
  for (const [apiType, reason] of [
    ["NSPrivacyAccessedAPICategoryUserDefaults", "CA92.1"],
    ["NSPrivacyAccessedAPICategoryFileTimestamp", "C617.1"],
    ["NSPrivacyAccessedAPICategorySystemBootTime", "35F9.1"],
  ]) {
    const declaration = configuredAccessedApis.find((entry) => entry?.NSPrivacyAccessedAPIType === apiType);
    if (!declaration?.NSPrivacyAccessedAPITypeReasons?.includes(reason)) {
      blockers.push(`Declare approved reason ${reason} for ${apiType} in apps/mobile/app.json.`);
    }
  }
}

// Expo's tracked config is the source of truth. When a local native folder is
// present, also make drift in the generated release project visible.
if (existsSync(infoPlistPath)) {
  requirePattern(infoPlistPath, /<key>CFBundleShortVersionString<\/key>\s*<string>1\.0\.0<\/string>/, "Regenerate iOS so CFBundleShortVersionString matches the tracked Expo version.");
  requirePattern(infoPlistPath, /<key>CFBundleVersion<\/key>\s*<string>1<\/string>/, "Regenerate iOS so CFBundleVersion matches the tracked Expo build number.");
}
if (existsSync(projectPath)) {
  requireText(projectPath, "CURRENT_PROJECT_VERSION = 1;", "Regenerate iOS so the native build number is 1.");
}
if (existsSync(privacyManifestPath)) {
  const privacyManifest = read(privacyManifestPath);
  for (const dataType of requiredPrivacyDataTypes) {
    if (!privacyManifest.includes(`<string>${dataType}</string>`)) blockers.push(`Regenerate iOS so PrivacyInfo.xcprivacy includes ${dataType}.`);
  }
  requireText(privacyManifestPath, "NSPrivacyCollectedDataTypePurposeAppFunctionality", "Regenerate iOS so the native privacy manifest includes the declared purpose.");
  requirePattern(privacyManifestPath, /<key>NSPrivacyTracking<\/key>\s*<false\/>/, "Keep tracking disabled in the generated app privacy manifest.");
  for (const [apiType, reason] of [
    ["NSPrivacyAccessedAPICategoryUserDefaults", "CA92.1"],
    ["NSPrivacyAccessedAPICategoryFileTimestamp", "C617.1"],
    ["NSPrivacyAccessedAPICategorySystemBootTime", "35F9.1"],
  ]) {
    if (!privacyManifest.includes(`<string>${apiType}</string>`) || !privacyManifest.includes(`<string>${reason}</string>`)) {
      blockers.push(`Regenerate iOS so PrivacyInfo.xcprivacy includes ${apiType} reason ${reason}.`);
    }
  }
}

const mobileSource = appSourcePaths.map((path) => read(path)).join("\n");
for (const [pattern, message] of [
  [/payslipinsights\.com\/pricing/i, "Remove pricing links from the free-companion iOS app."],
  [/href\s*=\s*["'`]\/pricing/i, "Remove web pricing calls to action from the free-companion iOS app."],
  [/upgrade when available/i, "Remove copy that prompts a future or outside-app upgrade."],
]) {
  if (pattern.test(mobileSource)) blockers.push(message);
}

requireText("apps/mobile/src/components/legal-links.tsx", "https://payslipinsights.com/privacy", "Keep a working privacy-policy link in the native account flow.");
requireText("apps/mobile/src/components/legal-links.tsx", "https://payslipinsights.com/terms", "Keep a working terms link in the native account flow.");

if (!read(projectPath).includes("DEVELOPMENT_TEAM =")) {
  notes.push("Apple signing is intentionally still manual: select the owning Developer Team before archiving.");
}

const manualChecks = [
  "Add only the production Supabase URL and publishable key to the release build, then prove sign-up, confirmation, password reset, upload, review, history, tax helper, and account deletion on a real iPhone.",
  "Keep iOS v1 free of checkout, pricing links, and outside-app purchase prompts. Explain the free companion business model in App Review notes.",
  "Make the public privacy policy and terms match the provider, retention, deletion, financial-data, and account-data behavior before submission.",
  "Complete App Store Connect privacy answers to match PrivacyInfo.xcprivacy; the manifest is source evidence, not proof that the questionnaire was submitted.",
  "Select the Apple Developer Team, create the App Store Connect record, archive build 1, upload it, and pass a TestFlight install plus the two-check lifetime quota on a release device.",
  "Provide App Review with a production-backed review account and a synthetic UK and Ireland payslip. Do not use a real employee document.",
];

console.log("\nPayslip Insights iOS source preflight\n");
if (notes.length > 0) {
  console.log("Notes:");
  notes.forEach((note) => console.log(`- ${note}`));
  console.log("");
}

if (blockers.length > 0) {
  console.error("Blocking source checks:");
  blockers.forEach((blocker) => console.error(`- ${blocker}`));
  console.error("\nManual release proof still required:");
  manualChecks.forEach((check) => console.error(`- ${check}`));
  process.exitCode = 1;
} else {
  console.log("Automated source checks passed for the free-companion release boundary.");
  console.log("\nManual release proof still required:");
  manualChecks.forEach((check) => console.log(`- ${check}`));
}
