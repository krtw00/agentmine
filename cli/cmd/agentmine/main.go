package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var version = "0.1.0"

func main() {
	rootCmd := &cobra.Command{
		Use:     "agentmine",
		Short:   "AI Project Manager - Redmine for AI agents",
		Version: version,
	}

	// Add subcommands
	rootCmd.AddCommand(initCmd())
	rootCmd.AddCommand(taskCmd())
	rootCmd.AddCommand(agentCmd())
	rootCmd.AddCommand(skillCmd())
	rootCmd.AddCommand(uiCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func initCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialize agentmine in current directory",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Initializing agentmine...")
			// TODO: Implement
			return nil
		},
	}
}

func taskCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "task",
		Short: "Manage tasks",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "add [title]",
		Short: "Add a new task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Adding task: %s\n", args[0])
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List tasks",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Listing tasks...")
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "show [id]",
		Short: "Show task details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Showing task: %s\n", args[0])
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "start [id]",
		Short: "Start working on a task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Starting task: %s\n", args[0])
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "done [id]",
		Short: "Mark task as done",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Completing task: %s\n", args[0])
			// TODO: Implement
			return nil
		},
	})

	return cmd
}

func agentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Manage agents",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Listing agents...")
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "run [name] [prompt]",
		Short: "Run an agent with a prompt",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Running agent %s with prompt: %s\n", args[0], args[1])
			// TODO: Implement
			return nil
		},
	})

	return cmd
}

func skillCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "skill",
		Short: "Manage skills",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Listing skills...")
			// TODO: Implement
			return nil
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "run [name]",
		Short: "Run a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Running skill: %s\n", args[0])
			// TODO: Implement
			return nil
		},
	})

	return cmd
}

func uiCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "ui",
		Short: "Start web UI",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Starting web UI on http://localhost:3333")
			// TODO: Implement
			return nil
		},
	}
}
