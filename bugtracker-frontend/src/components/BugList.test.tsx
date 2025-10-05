import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import BugList from "./BugList";
import { getBugs, createBug, updateBug, deleteBug } from "../api/bugs";
import { APP_VERSION } from "../config/app";

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../api/bugs");

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

describe("BugList", () => {
  const mockRouter = {
    query: {},
    pathname: "/",
    replace: jest.fn(),
  };

  const mockBugs = [
    { id: 1, title: "Bug 1", status: "Open", priority: "High", description: "Test" },
    { id: 2, title: "Bug 2", status: "In Progress", priority: "Medium", description: "Test" },
  ];

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (getBugs as jest.Mock).mockResolvedValue(mockBugs);
    jest.clearAllMocks();
  });

  const renderAndWaitForData = async () => {
    (getBugs as jest.Mock).mockResolvedValue(mockBugs);

    await act(async () => {
      render(<BugList />);
    });

    await waitFor(() => {
      expect(screen.getByText("All Bugs")).toBeInTheDocument();
      expect(screen.getByText("Bug 1")).toBeInTheDocument();
    });
  };

  describe("Initial Rendering", () => {
    it("renders bug list after loading", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("All Bugs")).toBeInTheDocument();
    });

    it("shows error message if bugs fetch fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (getBugs as jest.Mock).mockRejectedValue(new Error("Failed to fetch"));

      await act(async () => {
        render(<BugList />);
      });

      await waitFor(() => {
        expect(screen.getByText("Error: Failed to fetch bugs")).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Bug Operations", () => {
    beforeEach(async () => {
      await renderAndWaitForData();
    });

    it("opens add bug modal when clicking Add New Bug", async () => {
      const addButton = screen.getByRole("button", { name: /add new bug/i });
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByRole("heading", { name: /add new bug/i })).toBeInTheDocument();
    });

    it("handles creating a new bug", async () => {
      const newBug = { id: 3, title: "New Bug", status: "Open", priority: "High", description: "Test" };
      (createBug as jest.Mock).mockResolvedValue(newBug);
      (getBugs as jest.Mock).mockResolvedValue([...mockBugs, newBug]);

      await act(async () => {
        fireEvent.click(screen.getByText("Add New Bug"));
      });

      await act(async () => {
        await userEvent.type(screen.getByLabelText("Title"), "New Bug");
        await userEvent.type(screen.getByLabelText("Description"), "Test");
        fireEvent.submit(screen.getByRole("button", { name: /add bug/i }));
      });

      expect(createBug).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: "/",
        query: { createdBugTitle: "New Bug", showCreateNotification: true },
      });
    });

    it("handles editing a bug", async () => {
      const editButtons = screen.getAllByRole("button", { name: /edit/i });

      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      await act(async () => {
        const titleInput = screen.getByDisplayValue("Bug 1");
        await userEvent.clear(titleInput);
        await userEvent.type(titleInput, "Updated Bug");
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      });

      expect(updateBug).toHaveBeenCalledWith("1", expect.objectContaining({ title: "Updated Bug" }));
    });

    it("handles deleting a bug", async () => {
      (deleteBug as jest.Mock).mockResolvedValue(undefined);
      (getBugs as jest.Mock).mockResolvedValue([mockBugs[1]]);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      await act(async () => {
        const buttons = screen.getAllByRole("button", { name: /delete/i });
        fireEvent.click(buttons[buttons.length - 1]); // confirm delete
      });

      expect(deleteBug).toHaveBeenCalledWith("1");
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: "/",
        query: { deletedBugTitle: "Bug 1", showDeleteNotification: true },
      });
    });
  });

  describe("Notifications", () => {
    it("shows success notification after creating bug", async () => {
      mockRouter.query = { showCreateNotification: "true", createdBugTitle: "New Bug" };
      await renderAndWaitForData();

      await waitFor(() => {
        expect(screen.getByText(/successfully created bug "New Bug"/i)).toBeInTheDocument();
      });
    });

    it("shows success notification after deleting bug", async () => {
      mockRouter.query = { showDeleteNotification: "true", deletedBugTitle: "Bug 1" };
      await renderAndWaitForData();

      expect(screen.getByText(/successfully deleted bug/i)).toBeInTheDocument();
    });
  });

  describe("Status and Priority Display", () => {
    beforeEach(async () => {
      await renderAndWaitForData();
    });

    it("displays correct status indicators", () => {
      expect(screen.getByText("Open")).toHaveClass("bg-red-100");
      expect(screen.getByText("In Progress")).toHaveClass("bg-yellow-100");
    });

    it("displays correct priority indicators", () => {
      expect(screen.getByText("High")).toHaveClass("bg-red-100");
      expect(screen.getByText("Medium")).toHaveClass("bg-yellow-100");
    });
  });

  it("displays the correct version number", async () => {
    await act(async () => {
      render(<BugList />);
    });
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it("displays the version number in the header", async () => {
    await act(async () => {
      render(<BugList />);
    });

    const header = screen.getByRole("navigation");
    const versionElement = screen.getByText(`v${APP_VERSION}`);
    expect(header).toContainElement(versionElement);
  });
});
