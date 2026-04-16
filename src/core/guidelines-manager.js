/**
 * Guidelines Manager
 * Manages PROJECT_STATE.md — the dynamic project guidelines file.
 *
 * Strategy:
 *   - CLAUDE.md stays tiny (2 lines): just tells Claude to read PROJECT_STATE.md
 *   - PROJECT_STATE.md is updated after each significant task
 *   - On new session start, Claude reads PROJECT_STATE.md once
 *   - Weekly: auto-compress to remove stale/duplicate rules
 */

import * as fs from 'fs';
import * as path from 'path';

const CLAUDE_MD_STUB = `# Project Guidelines

> Before writing any code, read PROJECT_STATE.md in this directory.
> It contains the current architecture decisions, coding standards, and project status.
`;

const PROJECT_STATE_TEMPLATE = `# PROJECT_STATE.md
> Auto-managed by CCSO. Last updated: {DATE}

## Architecture Decisions
<!-- Add key architecture decisions here -->

## Coding Standards
<!-- Add project-specific coding standards here -->

## Current Status
<!-- CCSO updates this section after each Handoff -->

## Do NOT
<!-- Things Claude should never do in this project -->
`;

export class GuidelinesManager {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.claudeMdPath = path.join(projectDir, 'CLAUDE.md');
    this.statePath = path.join(projectDir, 'PROJECT_STATE.md');
  }

  /**
   * Initialize CLAUDE.md and PROJECT_STATE.md for a new project.
   */
  init() {
    // Create minimal CLAUDE.md stub
    if (!fs.existsSync(this.claudeMdPath)) {
      fs.writeFileSync(this.claudeMdPath, CLAUDE_MD_STUB);
      console.log('  ✅ CLAUDE.md נוצר (stub קטן)');
    } else {
      console.log('  ℹ️  CLAUDE.md כבר קיים — לא שונה');
    }

    // Create PROJECT_STATE.md template
    if (!fs.existsSync(this.statePath)) {
      const content = PROJECT_STATE_TEMPLATE.replace('{DATE}', new Date().toISOString().split('T')[0]);
      fs.writeFileSync(this.statePath, content);
      console.log('  ✅ PROJECT_STATE.md נוצר');
    } else {
      console.log('  ℹ️  PROJECT_STATE.md כבר קיים — לא שונה');
    }
  }

  /**
   * Append a handoff summary to the Current Status section.
   */
  updateStatus(summary) {
    if (!fs.existsSync(this.statePath)) this.init();

    const content = fs.readFileSync(this.statePath, 'utf8');
    const date = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const entry = `\n### ${date}\n${summary}\n`;

    // Insert after "## Current Status"
    const updated = content.replace(
      '## Current Status\n',
      `## Current Status\n${entry}`
    );

    // Update "Last updated" date
    const final = updated.replace(
      /> Auto-managed by CCSO\. Last updated: .*/,
      `> Auto-managed by CCSO. Last updated: ${date}`
    );

    fs.writeFileSync(this.statePath, final);
    console.log('  ✅ PROJECT_STATE.md עודכן');
  }

  /**
   * Return a compact summary of PROJECT_STATE.md for injection into a new session.
   * Skips empty sections to save tokens.
   */
  getSessionContext() {
    if (!fs.existsSync(this.statePath)) return '';

    const content = fs.readFileSync(this.statePath, 'utf8');
    // Remove comment placeholders and empty sections
    const cleaned = content
      .replace(/<!-- .* -->/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return `\n[Project Context from PROJECT_STATE.md]\n${cleaned}\n`;
  }

  /**
   * Compress PROJECT_STATE.md — remove duplicate lines and old status entries.
   * Keeps only the 5 most recent status entries.
   */
  compress() {
    if (!fs.existsSync(this.statePath)) return;

    const content = fs.readFileSync(this.statePath, 'utf8');
    const originalSize = content.length;

    // Split into sections
    const sections = content.split(/^## /m);
    const compressed = sections.map(section => {
      if (section.startsWith('Current Status')) {
        // Keep only last 5 entries (### headings)
        const entries = section.split(/^### /m);
        const header = entries.shift();
        const recent = entries.slice(-5);
        return '## ' + header + (recent.length ? '### ' + recent.join('### ') : '');
      }
      return (section.startsWith('#') ? '' : '## ') + section;
    });

    const result = compressed.join('').replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(this.statePath, result);

    const saved = originalSize - result.length;
    if (saved > 0) {
      console.log(`  ✅ PROJECT_STATE.md דוחס: חסכנו ${saved} תווים (~${Math.round(saved / 4)} טוקנים)`);
    }
  }
}
