'use strict';



const navbar = document.querySelector("[data-navbar]");
const navbarLinks = document.querySelectorAll("[data-nav-link]");
const navbarToggler = document.querySelector("[data-nav-toggler]");

navbarToggler.addEventListener("click", function () {
  navbar.classList.toggle("active");
  this.classList.toggle("active");
});

for (let i = 0; i < navbarLinks.length; i++) {
  navbarLinks[i].addEventListener("click", function () {
    navbar.classList.remove("active");
    navbarToggler.classList.remove("active");
  });
}



/**
 * search toggle
 */

const searchTogglers = document.querySelectorAll("[data-search-toggler]");
const searchBox = document.querySelector("[data-search-box]");

for (let i = 0; i < searchTogglers.length; i++) {
  searchTogglers[i].addEventListener("click", function () {
    searchBox.classList.toggle("active");
  });
}



/**
 * header
 */

const header = document.querySelector("[data-header]");
const backTopBtn = document.querySelector("[data-back-top-btn]");

window.addEventListener("scroll", function () {
  if (window.scrollY >= 200) {
    header.classList.add("active");
    backTopBtn.classList.add("active");
  } else {
    header.classList.remove("active");
    backTopBtn.classList.remove("active");
  }
});

  const modal = document.getElementById("imageModal");
  const modalContent = document.getElementById("imageModalContent");
  const closeBtn = document.getElementById("imageModalClose");
  const navLeft = document.getElementById("navLeft");
  const navRight = document.getElementById("navRight");

  const imageElements = document.querySelectorAll("#gallery .img-cover");
  const imageSources = Array.from(imageElements).map(img => 
  img.src.replace('/small/', '/large/')
  );
  let currentIndex = 0;

  const highResImages = Array.from(imageElements).map(img => {
  const smallSrc = img.getAttribute("src");
  const largeSrc = smallSrc.replace("/small/", "/large/");
  return {
    "@type": "ImageObject",
    "contentUrl": largeSrc,
    "url": largeSrc,
    "name": img.getAttribute("alt") || largeSrc.split('/').pop()
  };
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": highResImages
};

const jsonLdScript = document.createElement("script");
jsonLdScript.type = "application/ld+json";
jsonLdScript.textContent = JSON.stringify(structuredData);
document.head.appendChild(jsonLdScript);

function showModal(index) {
  currentIndex = index;
  modalContent.innerHTML = '';

  const numImages = imageSources.length;

  imageSources.forEach((src, i) => {
    const modalImg = document.createElement("img");
    modalImg.src = src;
    modalImg.classList.add("modal-image");
    modalContent.appendChild(modalImg);

    // Optional: log image load success/failure
    modalImg.onload = () => console.log(`Image ${i} loaded`);
    modalImg.onerror = () => console.warn(`Image ${i} failed to load: ${src}`);
  });

  modalContent.style.width = `${numImages * 100}%`;
  modal.style.display = "flex";

  // Wait a tiny bit to ensure layout happens before transform (optional)
  setTimeout(() => {
    updateSlidePosition();
    renderDots();
  }, 0);
}


  function updateSlidePosition() {
    modalContent.style.transform = `translateX(-${currentIndex * 100}%)`;
  updateDots();
  }

  function showNext() {
    if (currentIndex < imageSources.length - 1) {
      currentIndex++;
      updateSlidePosition();
    }
  }

  function showPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      updateSlidePosition();
    }
  }

  // Attach event listeners to images
  imageElements.forEach((img, index) => {
    img.addEventListener("click", () => showModal(index));
  });

  navLeft.addEventListener("click", showPrev);
  navRight.addEventListener("click", showNext);
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Close when clicking outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Swipe support
  let startX = 0;
  modalContent.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  modalContent.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (diff > 50) showNext();
    else if (diff < -50) showPrev();
  });

  // Keyboard support
  window.addEventListener("keydown", (e) => {
    if (modal.style.display === "flex") {
      if (e.key === "ArrowRight") showNext();
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "Escape") modal.style.display = "none";
    }
  });


const imageIndicator = document.getElementById("imageIndicator");

function renderDots() {
  imageIndicator.innerHTML = "";
  imageSources.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.classList.add("image-indicator-dot");
    if (i === currentIndex) dot.classList.add("active");

    dot.addEventListener("mouseenter", () => {
      currentIndex = i;
      updateSlidePosition();
      updateDots();
    });

    imageIndicator.appendChild(dot);
  });
}

function updateDots() {
  const dots = document.querySelectorAll(".image-indicator-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === currentIndex);
  });
}
