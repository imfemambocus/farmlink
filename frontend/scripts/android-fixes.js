/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');

const voicePluginPath = path.join(__dirname, '../node_modules/react-native-voice-enhanced/plugin/build/withVoice.js');

function fixVoicePlugin() {
    if (!fs.existsSync(voicePluginPath)) {
        console.log('ℹ️  react-native-voice-enhanced plugin file not found, skipping voice fix.');
        return;
    }

    let content = fs.readFileSync(voicePluginPath, 'utf8');

    // Check if the old require line exists
    const requireLine = "const pkg = require('@react-native-voice/voice/package.json');";

    if (content.includes(requireLine)) {
        // Replace it with the hardcoded pkg object
        const replacement = `const pkg = {
  name: 'react-native-voice-enhanced',
  version: '1.0.4'
};`;

        content = content.replace(requireLine, replacement);
        fs.writeFileSync(voicePluginPath, content, 'utf8');
        console.log('✅ Patched react-native-voice-enhanced plugin with fixed pkg object');
    } else {
        console.log('ℹ️  react-native-voice-enhanced plugin already patched or no replacement needed');
    }
}

// Fix debug AndroidManifest.xml
const debugManifestPath = path.join(__dirname, '../android/app/src/debug/AndroidManifest.xml');
const debugManifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <application
        android:name=".MainApplication"
        android:allowBackup="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        tools:replace="android:appComponentFactory,android:allowBackup"
        android:appComponentFactory="androidx.core.app.CoreComponentFactory"
        tools:targetApi="28"
        tools:ignore="GoogleAppIndexingWarning" />
</manifest>`;

// Fix main AndroidManifest.xml
const mainManifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

// Fix gradle.properties
const gradlePropertiesPath = path.join(__dirname, '../android/gradle.properties');

// Fix app/build.gradle
const appBuildGradlePath = path.join(__dirname, '../android/app/build.gradle');

// Function to fix main manifest
function fixMainManifest() {
    if (fs.existsSync(mainManifestPath)) {
        let mainManifestContent = fs.readFileSync(mainManifestPath, 'utf8');

        if (!mainManifestContent.includes('tools:replace')) {
            mainManifestContent = mainManifestContent.replace(
                /<application([^>]*)>/,
                (match, attributes) => {
                    const updatedAttributes = attributes.replace(
                        /android:appComponentFactory="androidx\.core\.app\.CoreComponentFactory"/,
                        'tools:replace="android:appComponentFactory,android:allowBackup"\n        android:appComponentFactory="androidx.core.app.CoreComponentFactory"'
                    );
                    return `<application${updatedAttributes}>`;
                }
            );

            fs.writeFileSync(mainManifestPath, mainManifestContent);
            console.log('✅ Fixed main AndroidManifest.xml');
        } else {
            console.log('ℹ️  Main AndroidManifest.xml already has tools:replace');
        }
    }
}

// Function to fix gradle.properties
function fixGradleProperties() {
    if (fs.existsSync(gradlePropertiesPath)) {
        let gradleContent = fs.readFileSync(gradlePropertiesPath, 'utf8');

        // Add jetifier if not present
        if (!gradleContent.includes('android.enableJetifier=true')) {
            gradleContent += '\n# Force AndroidX compatibility\nandroid.enableJetifier=true\n';
            fs.writeFileSync(gradlePropertiesPath, gradleContent);
            console.log('✅ Added android.enableJetifier=true to gradle.properties');
        } else {
            console.log('ℹ️  gradle.properties already has jetifier enabled');
        }
    }
}

// IMPROVED Function to fix app/build.gradle
function fixAppBuildGradle() {
    if (!fs.existsSync(appBuildGradlePath)) {
        console.log('❌ build.gradle not found');
        return;
    }

    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    console.log('📖 Original build.gradle length:', buildGradleContent.length);

    let modified = false;

    // Add configurations.all block if not present
    if (!buildGradleContent.includes('configurations.all')) {
        console.log('🔧 Adding configurations.all block...');

        const configurationsBlock = `
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        eachDependency { details ->
            if (details.requested.group == 'com.android.support') {
                details.useTarget group: 'androidx.legacy', name: 'legacy-support-v4', version: '1.0.0'
            }
        }
    }
}

`;

        // Find android block and insert before it
        const androidBlockRegex = /(\s*)(android\s*\{)/;
        if (androidBlockRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
                androidBlockRegex,
                `$1${configurationsBlock}$1$2`
            );
            modified = true;
            console.log('✅ Added configurations.all block');
        } else {
            console.log('❌ Could not find android block to insert configurations');
        }
    } else {
        console.log('ℹ️  configurations.all block already exists');
    }

    // Add androidx.core dependency if not present
    if (!buildGradleContent.includes("implementation 'androidx.core:core:1.13.1'")) {
        console.log('🔧 Adding androidx.core dependency...');

        // Find dependencies block - look for the opening brace after "dependencies"
        const dependenciesRegex = /(dependencies\s*\{\s*)/;
        const match = buildGradleContent.match(dependenciesRegex);

        if (match) {
            const insertPoint = match.index + match[0].length;
            const beforeDeps = buildGradleContent.substring(0, insertPoint);
            const afterDeps = buildGradleContent.substring(insertPoint);

            buildGradleContent = beforeDeps + "    implementation 'androidx.core:core:1.13.1'\n" + afterDeps;
            modified = true;
            console.log('✅ Added androidx.core dependency');
        } else {
            console.log('❌ Could not find dependencies block');
        }
    } else {
        console.log('ℹ️  androidx.core dependency already exists');
    }

    if (modified) {
        fs.writeFileSync(appBuildGradlePath, buildGradleContent);
        console.log('💾 Saved modified build.gradle');
        console.log('📖 New build.gradle length:', buildGradleContent.length);
    }
}

// Function to create debug manifest
function createDebugManifest() {
    const debugDir = path.dirname(debugManifestPath);
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
        console.log('📁 Created debug manifest directory');
    }

    if (!fs.existsSync(debugManifestPath)) {
        fs.writeFileSync(debugManifestPath, debugManifestContent);
        console.log('✅ Created debug AndroidManifest.xml');
    } else {
        console.log('ℹ️  Debug AndroidManifest.xml already exists');
    }
}

// Wait for files to be generated (in case there's a timing issue)
function waitForFiles(maxWaitMs = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkFiles = () => {
            if (fs.existsSync(appBuildGradlePath)) {
                console.log('✅ build.gradle found after', Date.now() - startTime, 'ms');
                resolve(true);
            } else if (Date.now() - startTime > maxWaitMs) {
                console.log('⏰ Timeout waiting for build.gradle');
                resolve(false);
            } else {
                setTimeout(checkFiles, 1000);
            }
        };
        checkFiles();
    });
}

// Main execution
async function main() {
    fixVoicePlugin();

    // Only run if android directory exists (i.e., during EAS build)
    if (fs.existsSync(path.join(__dirname, '../android'))) {
        console.log('🔧 Applying Android configuration fixes...');

        // Wait for build.gradle to be generated if it doesn't exist yet
        if (!fs.existsSync(appBuildGradlePath)) {
            console.log('⏳ Waiting for build.gradle to be generated...');
            await waitForFiles();
        }

        try {
            fixMainManifest();
            fixGradleProperties();
            fixAppBuildGradle();
            createDebugManifest();
            console.log('🎉 All Android fixes applied successfully!');
        } catch (error) {
            console.error('❌ Error applying fixes:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    } else {
        console.log('📱 Android directory not found, skipping fixes');
    }
}

// Run the main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});