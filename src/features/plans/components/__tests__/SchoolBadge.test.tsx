import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SchoolBadge, { isTransferSchool } from "../SchoolBadge";

describe("isTransferSchool", () => {
  it("flags High + Alternative as transfer", () => {
    expect(
      isTransferSchool({ ncessch: "s1", name: "Transfer HS", schoolLevel: 3, schoolType: 4 })
    ).toBe(true);
  });

  it("does not flag High + Regular", () => {
    expect(
      isTransferSchool({ ncessch: "s2", name: "Regular HS", schoolLevel: 3, schoolType: 1 })
    ).toBe(false);
  });

  it("does not flag Middle + Alternative", () => {
    expect(
      isTransferSchool({ ncessch: "s3", name: "Alt MS", schoolLevel: 2, schoolType: 4 })
    ).toBe(false);
  });
});

describe("SchoolBadge", () => {
  it("renders nothing when no link is provided", () => {
    const { container } = render(<SchoolBadge link={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders school name and level label in inline variant", () => {
    render(
      <SchoolBadge
        link={{ ncessch: "s1", name: "Lincoln HS", schoolLevel: 3, schoolType: 1 }}
      />
    );
    expect(screen.getByText(/Lincoln HS/)).toBeInTheDocument();
    expect(screen.getByText(/High/)).toBeInTheDocument();
  });

  it("renders Transfer pill for HS + Alternative schools", () => {
    render(
      <SchoolBadge
        link={{ ncessch: "s1", name: "Transfer HS", schoolLevel: 3, schoolType: 4 }}
      />
    );
    expect(screen.getByText("Transfer")).toBeInTheDocument();
  });

  it("does not render Transfer pill for non-transfer schools", () => {
    render(
      <SchoolBadge
        link={{ ncessch: "s1", name: "Lincoln HS", schoolLevel: 3, schoolType: 1 }}
      />
    );
    expect(screen.queryByText("Transfer")).not.toBeInTheDocument();
  });

  it("block variant shows School label and type", () => {
    render(
      <SchoolBadge
        variant="block"
        link={{ ncessch: "s1", name: "Transfer HS", schoolLevel: 3, schoolType: 4 }}
      />
    );
    expect(screen.getByText("School")).toBeInTheDocument();
    expect(screen.getByText(/Alternative/)).toBeInTheDocument();
    expect(screen.getByText("Transfer")).toBeInTheDocument();
  });
});
