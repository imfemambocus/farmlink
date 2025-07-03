/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Paths
const debugManifestPath = path.join(__dirname, '../android/app/src/debug/AndroidManifest.xml');
const mainManifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
const gradlePropertiesPath = path.join(__dirname, '../android/gradle.properties');
const appBuildGradlePath = path.join(__dirname, '../android/app/build.gradle');
const voicePackagePath = path.join(__dirname, '../node_modules/@react-native-voice/voice/android');

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

// Fix voice package namespace conflict
function fixVoiceNamespaceConflict() {
    if (!fs.existsSync(voicePackagePath)) {
        console.log('ℹ️  @react-native-voice/voice not found, skipping namespace fix');
        return;
    }

    console.log('🔧 Fixing voice package namespace conflict...');

    const oldNamespace = 'com.wenkesj.voice';
    const newNamespace = 'com.wenkesj.voice.original';

    try {
        // Fix build.gradle
        const buildGradlePath = path.join(voicePackagePath, 'build.gradle');
        if (fs.existsSync(buildGradlePath)) {
            let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
            if (buildGradleContent.includes(oldNamespace)) {
                buildGradleContent = buildGradleContent.replace(/namespace "com\.wenkesj\.voice"/g, `namespace "${newNamespace}"`);
                buildGradleContent = buildGradleContent.replace(/codegenJavaPackageName = "com\.wenkesj\.voice"/g, `codegenJavaPackageName = "${newNamespace}"`);
                fs.writeFileSync(buildGradlePath, buildGradleContent);
                console.log('✅ Updated voice package build.gradle namespace');
            }
        }

        // Fix AndroidManifest.xml
        const manifestPath = path.join(voicePackagePath, 'src/main/AndroidManifest.xml');
        if (fs.existsSync(manifestPath)) {
            let manifestContent = fs.readFileSync(manifestPath, 'utf8');
            if (manifestContent.includes(oldNamespace)) {
                manifestContent = manifestContent.replace(/package="com\.wenkesj\.voice"/g, `package="${newNamespace}"`);
                fs.writeFileSync(manifestPath, manifestContent);
                console.log('✅ Updated voice package AndroidManifest.xml namespace');
            }
        }

        // Fix all Kotlin/Java source files
        const srcPath = path.join(voicePackagePath, 'src');
        if (fs.existsSync(srcPath)) {
            updatePackageInSourceFiles(srcPath, oldNamespace, newNamespace);
        }

        console.log('✅ Voice package namespace conflict resolved');
    } catch (error) {
        console.error('❌ Error fixing voice namespace:', error.message);
    }
}

// Recursively update package declarations in source files
function updatePackageInSourceFiles(dir, oldNamespace, newNamespace) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            updatePackageInSourceFiles(filePath, oldNamespace, newNamespace);
        } else if (file.endsWith('.kt') || file.endsWith('.java')) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes(oldNamespace)) {
                content = content.replace(/package com\.wenkesj\.voice/g, `package ${newNamespace}`);
                content = content.replace(/import com\.wenkesj\.voice/g, `import ${newNamespace}`);
                fs.writeFileSync(filePath, content);
            }
        }
    }
}

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
        }
    }
}

function fixGradleProperties() {
    if (fs.existsSync(gradlePropertiesPath)) {
        let gradleContent = fs.readFileSync(gradlePropertiesPath, 'utf8');
        let modified = false;

        const requiredProperties = [
            'android.enableJetifier=true',
            'android.useAndroidX=true',
            'org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC',
            'org.gradle.daemon=true',
            'org.gradle.parallel=true'
        ];

        // Remove any existing memory settings first
        gradleContent = gradleContent.replace(/org\.gradle\.jvmargs=.*\n?/g, '');
        gradleContent = gradleContent.replace(/org\.gradle\.daemon=.*\n?/g, '');
        gradleContent = gradleContent.replace(/org\.gradle\.parallel=.*\n?/g, '');

        requiredProperties.forEach(prop => {
            const propKey = prop.split('=')[0];
            if (!gradleContent.includes(propKey)) {
                gradleContent += `\n${prop}`;
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(gradlePropertiesPath, gradleContent);
            console.log('✅ Enhanced gradle.properties');
        }
    }
}

function fixAppBuildGradle() {
    if (!fs.existsSync(appBuildGradlePath)) {
        return;
    }

    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    let modified = false;

    // Add configurations block
    if (!buildGradleContent.includes('configurations.all')) {
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
        const androidBlockRegex = /(\s*)(android\s*\{)/;
        if (androidBlockRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
                androidBlockRegex,
                `$1${configurationsBlock}$1$2`
            );
            modified = true;
            console.log('✅ Added configurations.all block');
        }
    }

    // Add packaging options for any remaining conflicts
    if (!buildGradleContent.includes('packagingOptions')) {
        const packagingOptionsBlock = `
    packagingOptions {
        pickFirst '**/BuildConfig.class'
        pickFirst '**/com/wenkesj/voice/**'
        
        exclude '/META-INF/DEPENDENCIES'
        exclude '/META-INF/LICENSE'
        exclude '/META-INF/LICENSE.txt'
        exclude '/META-INF/NOTICE'
        exclude '/META-INF/NOTICE.txt'
    }

    dexOptions {
        javaMaxHeapSize "8g"
        preDexLibraries = false
        jumboMode = true
    }
`;

        const androidBlockStart = buildGradleContent.indexOf('android {');
        if (androidBlockStart !== -1) {
            const openBraceIndex = buildGradleContent.indexOf('{', androidBlockStart);
            if (openBraceIndex !== -1) {
                const beforeAndroid = buildGradleContent.substring(0, openBraceIndex + 1);
                const afterAndroid = buildGradleContent.substring(openBraceIndex + 1);
                buildGradleContent = beforeAndroid + packagingOptionsBlock + afterAndroid;
                modified = true;
                console.log('✅ Added packaging options');
            }
        }
    }

    // Add androidx.core dependency
    if (!buildGradleContent.includes("implementation 'androidx.core:core:1.13.1'")) {
        const dependenciesRegex = /(dependencies\s*\{\s*)/;
        const match = buildGradleContent.match(dependenciesRegex);
        if (match) {
            const insertPoint = match.index + match[0].length;
            const beforeDeps = buildGradleContent.substring(0, insertPoint);
            const afterDeps = buildGradleContent.substring(insertPoint);
            buildGradleContent = beforeDeps + "    implementation 'androidx.core:core:1.13.1'\n" + afterDeps;
            modified = true;
            console.log('✅ Added androidx.core dependency');
        }
    }

    if (modified) {
        fs.writeFileSync(appBuildGradlePath, buildGradleContent);
        console.log('✅ Updated build.gradle');
    }
}

function createDebugManifest() {
    const debugDir = path.dirname(debugManifestPath);
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    if (!fs.existsSync(debugManifestPath)) {
        fs.writeFileSync(debugManifestPath, debugManifestContent);
        console.log('✅ Created debug AndroidManifest.xml');
    }
}

async function waitForFiles(maxWaitMs = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkFiles = () => {
            if (fs.existsSync(appBuildGradlePath)) {
                resolve(true);
            } else if (Date.now() - startTime > maxWaitMs) {
                resolve(false);
            } else {
                setTimeout(checkFiles, 1000);
            }
        };
        checkFiles();
    });
}

// Clean build cache
function cleanBuildCache() {
    const cleanDirs = [
        path.join(__dirname, '../android/build'),
        path.join(__dirname, '../android/app/build'),
        path.join(__dirname, '../android/.gradle'),
        path.join(__dirname, '../android/app/.cxx')
    ];

    cleanDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
                console.log(`🧹 Cleaned ${path.basename(dir)}`);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });
}

async function main() {
    // Fix voice package namespace conflict FIRST
    fixVoiceNamespaceConflict();

    if (fs.existsSync(path.join(__dirname, '../android'))) {
        console.log('🔧 Applying Android configuration fixes...');

        if (!fs.existsSync(appBuildGradlePath)) {
            console.log('⏳ Waiting for build.gradle...');
            await waitForFiles();
        }

        try {
            fixMainManifest();
            fixGradleProperties();
            fixAppBuildGradle();
            createDebugManifest();
            cleanBuildCache();

            console.log('🎉 All fixes applied successfully!');
            console.log('📝 Voice package namespace conflict resolved');
            console.log('📝 Run: npx expo run:android --device');
        } catch (error) {
            console.error('❌ Error applying fixes:', error.message);
            process.exit(1);
        }
    } else {
        console.log('📱 Android directory not found, skipping Android fixes');
    }
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});